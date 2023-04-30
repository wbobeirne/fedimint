import React, {
  createContext,
  Dispatch,
  ReactNode,
  useEffect,
  useReducer,
} from 'react';
import {
  SetupState,
  SetupAction,
  SETUP_ACTION_TYPE,
  SetupProgress,
  Network,
  SocketConnectionStatus,
} from './types';
import { ApiInterface, NoopGuardianApi } from './GuardianApi';

const initialState: SetupState = {
  role: null,
  progress: SetupProgress.Start,
  myName: '',
  federationName: '',
  finalityDelay: 10,
  network: Network.Testnet,
  password: '',
  numPeers: 0,
  hostServerUrl: '',
  hostConnectionStatus: SocketConnectionStatus.Disconnected,
  peers: [],
  myVerificationCode: '',
  peerVerificationCodes: [],
  federationConnectionString: '',
};

const reducer = (state: SetupState, action: SetupAction): SetupState => {
  switch (action.type) {
    case SETUP_ACTION_TYPE.SET_ROLE:
      return { ...state, role: action.payload };
    case SETUP_ACTION_TYPE.SET_PROGRESS:
      return { ...state, progress: action.payload };
    case SETUP_ACTION_TYPE.SET_MY_NAME:
      return { ...state, myName: action.payload };
    case SETUP_ACTION_TYPE.SET_FEDERATION_NAME:
      return { ...state, federationName: action.payload };
    case SETUP_ACTION_TYPE.SET_FINALITY_DELAY:
      return { ...state, finalityDelay: action.payload };
    case SETUP_ACTION_TYPE.SET_NETWORK:
      return { ...state, network: action.payload };
    case SETUP_ACTION_TYPE.SET_PASSWORD:
      return { ...state, password: action.payload };
    case SETUP_ACTION_TYPE.SET_NUM_PEERS:
      return { ...state, numPeers: action.payload };
    case SETUP_ACTION_TYPE.SET_HOST_SERVER_URL:
      return { ...state, hostServerUrl: action.payload };
    case SETUP_ACTION_TYPE.SET_HOST_CONNECTION_STATUS:
      return { ...state, hostConnectionStatus: action.payload };
    case SETUP_ACTION_TYPE.SET_PEERS:
      return { ...state, peers: action.payload };
    case SETUP_ACTION_TYPE.SET_MY_VERIFICATION_CODE:
      return { ...state, myVerificationCode: action.payload };
    case SETUP_ACTION_TYPE.SET_PEER_VERIFICATION_CODES:
      return { ...state, peerVerificationCodes: action.payload };
    case SETUP_ACTION_TYPE.SET_FEDERATION_CONNECTION_STRING:
      return { ...state, federationConnectionString: action.payload };
    default:
      return state;
  }
};

export const GuardianContext = createContext<{
  api: ApiInterface;
  state: SetupState;
  dispatch: Dispatch<SetupAction>;
}>({
  api: new NoopGuardianApi(),
  state: initialState,
  dispatch: () => null,
});

export interface GuardianProviderProps {
  api: ApiInterface;
  children: ReactNode;
}

export const GuardianProvider: React.FC<GuardianProviderProps> = ({
  api,
  children,
}: GuardianProviderProps) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Watch for peers
  useEffect(() => {
    const interval = setInterval(() => {
      api.getConsensusParams().then((res) => {
        console.log({ res });
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <GuardianContext.Provider value={{ state, dispatch, api }}>
      {children}
    </GuardianContext.Provider>
  );
};
