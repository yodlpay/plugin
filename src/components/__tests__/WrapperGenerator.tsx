import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Config, WagmiProvider } from 'wagmi'

const queryClient = new QueryClient()

export default function WrapperGenerator(config: Config) {
  return function TestWagmiProvider(props: any) {
    return (
      <WagmiProvider config={config} reconnectOnMount={false} {...props}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>{null}</RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    )
  }
}
