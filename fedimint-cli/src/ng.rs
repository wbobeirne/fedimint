use std::str::FromStr;
use std::time::Duration;

use bitcoin::secp256k1;
use bitcoin_hashes::hex::ToHex;
use clap::Subcommand;
use fedimint_client::ClientBuilder;
use fedimint_core::config::ClientConfig;
use fedimint_core::core::{LEGACY_HARDCODED_INSTANCE_ID_LN, LEGACY_HARDCODED_INSTANCE_ID_MINT};
use fedimint_core::db::IDatabase;
use fedimint_core::encoding::Decodable;
use fedimint_core::module::registry::ModuleDecoderRegistry;
use fedimint_core::task::TaskGroup;
use fedimint_core::{Amount, TieredMulti, TieredSummary};
use fedimint_ln_client::{LightningClientExt, LightningClientGen, LnPayState};
use fedimint_mint_client::{MintClientExt, MintClientGen, MintClientModule, SpendableNote};
use fedimint_wallet_client::WalletClientGen;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::info;

#[derive(Debug, Clone, Subcommand)]
pub enum ClientNg {
    Info,
    Reissue {
        #[clap(value_parser = parse_ecash)]
        notes: TieredMulti<SpendableNote>,
    },
    Spend {
        amount: Amount,
    },
    LnPay {
        bolt11: lightning_invoice::Invoice,
    },
    ListGateways,
    SwitchGateway {
        /// node public key for a gateway
        #[clap(value_parser = parse_node_pub_key)]
        pubkey: secp256k1::PublicKey,
    },
}

pub fn parse_node_pub_key(s: &str) -> Result<secp256k1::PublicKey, secp256k1::Error> {
    secp256k1::PublicKey::from_str(s)
}

pub async fn handle_ng_command<D: IDatabase>(
    command: ClientNg,
    cfg: ClientConfig,
    db: D,
) -> anyhow::Result<serde_json::Value> {
    let mut tg = TaskGroup::new();

    let fed_id = cfg.federation_id;
    let mut client_builder = ClientBuilder::default();
    client_builder.with_module(MintClientGen);
    client_builder.with_module(LightningClientGen);
    client_builder.with_module(WalletClientGen);
    client_builder.with_primary_module(1);
    client_builder.with_config(cfg);
    client_builder.with_database(db);
    let client = client_builder.build(&mut tg).await?;

    match command {
        ClientNg::Info => {
            let mint_client = client
                .get_module_client::<MintClientModule>(LEGACY_HARDCODED_INSTANCE_ID_MINT)
                .unwrap();
            let summary = mint_client
                .get_wallet_summary(
                    &mut client.db().begin_transaction().await.with_module_prefix(1),
                )
                .await;
            Ok(serde_json::to_value(InfoResponse {
                total_msat: summary.total_amount(),
                denominations_msat: summary,
            })
            .unwrap())
        }
        ClientNg::Reissue { notes } => {
            let amount = notes.total_amount();

            let operation_id = client.reissue_external_notes(notes).await?;
            let mut updates = client
                .subscribe_reissue_external_notes_updates(operation_id)
                .await
                .unwrap();

            while let Some(update) = updates.next().await {
                if let fedimint_mint_client::ReissueExternalNotesState::Failed(e) = update {
                    return Err(anyhow::Error::msg(format!("Reissue failed: {e}")));
                }

                info!("Update: {:?}", update);
            }

            Ok(serde_json::to_value(amount).unwrap())
        }
        ClientNg::Spend { amount } => {
            let (operation, notes) = client.spend_notes(amount, Duration::from_secs(30)).await?;
            info!("Spend e-cash operation: {operation:?}");

            Ok(serde_json::to_value(notes).unwrap())
        }
        ClientNg::LnPay { bolt11 } => {
            let mut dbtx = client.db().begin_transaction().await;
            let active_gateway = client
                .fetch_active_gateway(&mut dbtx.with_module_prefix(LEGACY_HARDCODED_INSTANCE_ID_LN))
                .await?;
            dbtx.commit_tx().await;

            let operation_id = client
                .pay_bolt11_invoice(fed_id, bolt11, active_gateway)
                .await?;

            let mut updates = client.subscribe_ln_pay_updates(operation_id).await?;

            while let Some(update) = updates.next().await {
                match update {
                    LnPayState::Success { preimage } => {
                        return Ok(serde_json::to_value(PayInvoiceResponse {
                            operation_id: operation_id.to_hex(),
                            preimage,
                        })
                        .unwrap());
                    }
                    LnPayState::Refunded { refund_txid } => {
                        client
                            .await_lightning_refund(operation_id, refund_txid)
                            .await?;
                    }
                    _ => {}
                }

                info!("Update: {:?}", update);
            }

            return Err(anyhow::anyhow!("Lightning Payment failed"));
        }
        ClientNg::ListGateways => {
            let gateways = client.fetch_registered_gateways().await?;
            if gateways.is_empty() {
                return Ok(serde_json::to_value(Vec::<String>::new()).unwrap());
            }

            let mut gateways_json = json!(&gateways);
            let mut dbtx = client.db().begin_transaction().await;
            let active_gateway = client
                .fetch_active_gateway(&mut dbtx.with_module_prefix(LEGACY_HARDCODED_INSTANCE_ID_LN))
                .await?;
            dbtx.commit_tx().await;

            gateways_json
                .as_array_mut()
                .expect("gateways_json is not an array")
                .iter_mut()
                .for_each(|gateway| {
                    if gateway["node_pub_key"] == json!(active_gateway.node_pub_key) {
                        gateway["active"] = json!(true);
                    } else {
                        gateway["active"] = json!(false);
                    }
                });
            Ok(serde_json::to_value(gateways_json).unwrap())
        }
        ClientNg::SwitchGateway { pubkey } => {
            let mut dbtx = client.db().begin_transaction().await;
            let gateway = client
                .switch_active_gateway(
                    Some(pubkey),
                    &mut dbtx.with_module_prefix(LEGACY_HARDCODED_INSTANCE_ID_LN),
                )
                .await?;
            let mut gateway_json = json!(&gateway);
            gateway_json["active"] = json!(true);
            dbtx.commit_tx().await;
            Ok(serde_json::to_value(gateway_json).unwrap())
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct InfoResponse {
    total_msat: Amount,
    denominations_msat: TieredSummary,
}

pub fn parse_ecash(s: &str) -> anyhow::Result<TieredMulti<SpendableNote>> {
    let bytes = base64::decode(s)?;
    Ok(Decodable::consensus_decode(
        &mut std::io::Cursor::new(bytes),
        &ModuleDecoderRegistry::default(),
    )?)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PayInvoiceResponse {
    operation_id: String,
    preimage: String,
}
