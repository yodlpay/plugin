import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { Config, useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import WrapperGenerator from '../WrapperGenerator';

export default async function mockConnect(config: Config) {
  function MockConnect() {
    const { connect } = useConnect();
    const { isConnected } = useAccount();

    useEffect(() => {
      connect({
        connector: injected(),
      });
    }, [connect]);

    return <>{isConnected && 'isConnected'}</>;
  }
  render(<MockConnect />, { wrapper: WrapperGenerator(config) });
  await screen.findByText('isConnected');
}
