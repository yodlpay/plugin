import { injected, walletConnect } from 'wagmi/connectors';

export function metaMaskConnector() {
  return injected({ target: 'metaMask' });
}

export function walletConnect2Connector() {
  return walletConnect({
    projectId: 'fba45f29001cdfe9595549f725192905',
  });
}

export function walletConnectConnector() {
  return walletConnect({
    projectId: 'fba45f29001cdfe9595549f725192905',
  });
}
