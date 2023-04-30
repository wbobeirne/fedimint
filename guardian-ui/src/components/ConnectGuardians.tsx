import {
  FormControl,
  FormLabel,
  Input,
  VStack,
  Button,
  FormHelperText,
  FormErrorMessage,
  Icon,
  TableContainer,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useTheme,
  HStack,
  Spinner,
} from '@chakra-ui/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGuardianContext } from '../hooks';
import {
  ConsensusConfig,
  GuardianRole,
  Network,
  SETUP_ACTION_TYPE,
} from '../types';
import { CopyInput } from './ui/CopyInput';
import { ReactComponent as ArrowRightIcon } from '../assets/svgs/arrow-right.svg';
import { CheckCircleIcon } from '@chakra-ui/icons';

interface Props {
  next(): void;
}

export const ConnectGuardians: React.FC<Props> = ({ next }) => {
  const {
    state: { role, hostServerUrl, peers, numPeers },
    dispatch,
    api,
  } = useGuardianContext();
  const theme = useTheme();
  const [hostUrl, setHostUrl] = useState(hostServerUrl || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectError, setConnectError] = useState<string>();
  const [isFetchingConfig, setIsFetchingConfig] = useState(false);
  const [config, setConfig] = useState<ConsensusConfig>();

  const isAllConnected =
    numPeers &&
    numPeers == peers.length &&
    peers.every((peer) => peer.status.connected);
  const isAllApproved =
    isAllConnected && peers.every((peer) => peer.status.approved);

  // Watch for peers approval. Once all are approved we move on.
  useEffect(() => {
    if (!isAllApproved) return;
    next();
  }, [isAllApproved, next]);

  const handleApprove = useCallback(() => {
    next();
  }, [next]);

  const handleConnect = useCallback(async () => {
    setConnectError(undefined);
    setIsConnecting(true);
    try {
      // TODO: Actually fetch
      // const res = await api.getConsensusParams();
      setIsConnected(true);
      // TODO: Remove me, just for testing
      dispatch({ type: SETUP_ACTION_TYPE.SET_NUM_PEERS, payload: 2 });
      dispatch({
        type: SETUP_ACTION_TYPE.SET_PEERS,
        payload: [
          {
            name: 'Leader',
            status: { connected: false, approved: true },
          },
          {
            name: 'Follower',
            status: { connected: true, approved: false },
          },
        ],
      });
      if (role === GuardianRole.Host) return;
      setTimeout(() => {
        dispatch({
          type: SETUP_ACTION_TYPE.SET_PEERS,
          payload: [
            {
              name: 'Leader',
              status: { connected: true, approved: true },
            },
            {
              name: 'Follower',
              status: { connected: true, approved: false },
            },
          ],
        });
        setIsFetchingConfig(true);
        setTimeout(() => {
          setConfig({
            federationName: 'Federation',
            finalityDelay: 10,
            network: Network.Mainnet,
          });
        }, 1000);
      }, 2000);
    } catch (err: any) {
      console.log({ err });
      setConnectError(err.message || err.toString());
    }
    setIsConnecting(false);
  }, [hostUrl, api, dispatch]);

  // FAKE CONNECT FOR LEADER. REMOVE ME.
  useEffect(() => {
    if (role !== GuardianRole.Host) return;
    handleConnect();
  }, [handleConnect, role]);

  let content: React.ReactNode;
  if (role === GuardianRole.Host) {
    content = (
      <FormControl>
        <FormLabel>Invite Followers</FormLabel>
        <CopyInput value={process.env.REACT_APP_FM_CONFIG_API || ''} />
        <FormHelperText>
          Share this link with the other Guardians
        </FormHelperText>
      </FormControl>
    );
  } else {
    let innerContent: React.ReactNode;
    if (config) {
      innerContent = (
        <>
          <TableContainer width='100%'>
            <Table variant='simple'>
              <Tbody>
                {Object.entries(config).map(([key, value]) => (
                  <Tr key={key}>
                    <Td>{key}</Td>
                    <Td>{value}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
          <div>
            <Button onClick={handleApprove}>Approve</Button>
          </div>
        </>
      );
    } else if (isFetchingConfig) {
      innerContent = <Spinner />;
    } else {
      innerContent = (
        <>
          <FormControl>
            <FormLabel>Leader server URL</FormLabel>
            <Input
              value={hostUrl}
              onChange={(ev) => setHostUrl(ev.currentTarget.value)}
              placeholder='ws://...'
              isDisabled={isConnected}
            />
            {connectError ? (
              <FormErrorMessage>{connectError}</FormErrorMessage>
            ) : (
              <FormHelperText
                color={isConnected ? theme.colors.green[400] : undefined}
              >
                {isConnected
                  ? 'Successfully connected to leader!'
                  : 'Your leader will need to send this to you.'}
              </FormHelperText>
            )}
          </FormControl>

          {!isConnected && (
            <div>
              <Button
                isDisabled={!hostUrl || isConnected}
                isLoading={isConnecting}
                leftIcon={<Icon as={ArrowRightIcon} />}
                onClick={handleConnect}
              >
                Connect
              </Button>
            </div>
          )}
        </>
      );
    }

    content = (
      <VStack gap={3} justify='start' align='start' width='100%'>
        {innerContent}
      </VStack>
    );
  }

  const tablePeers = useMemo(() => {
    let memoPeers = [...peers];
    for (let i = 0; i < numPeers; i++) {
      if (memoPeers[i]) continue;
      memoPeers = [
        ...memoPeers,
        {
          name: '',
          status: { connected: false, approved: false },
        },
      ];
    }
    return memoPeers;
  }, [peers]);

  return (
    <VStack width='100%' justify='start' align='start' maxWidth={400} gap={8}>
      {content}
      {isConnected && peers && (
        <TableContainer width='100%'>
          <Table variant='simple'>
            <Thead>
              <Tr>
                <Th>Peer name</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {tablePeers.map((peer, idx) => (
                <Tr key={idx}>
                  <Td>{peer.name || 'Unknown peer'}</Td>
                  <Td>
                    <HStack align='center'>
                      {peer.status.connected ? (
                        <>
                          <CheckCircleIcon
                            boxSize={4}
                            color={theme.colors.green[400]}
                          />
                          <span>Connected</span>
                        </>
                      ) : (
                        <>
                          <Spinner size='xs' />
                          <span>Waiting</span>
                        </>
                      )}
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}
    </VStack>
  );
};
