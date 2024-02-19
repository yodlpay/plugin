import { Invoice, coinIdsToCoinConfig } from "@hiropay/common";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { goerli } from "viem/chains";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import "wagmi/window";
import { invoiceStore } from "../../contexts/useInvoiceStore";
import ChainDialog from "../../dialogs/ChainDialog";
import WalletDialog from "../../dialogs/WalletDialog";

const queryClient = new QueryClient();

function WrapperGenerator(config: any) {
  return function TestWagmiProvider(props: any) {
    <WagmiProvider config={config} reconnectOnMount={false} {...props}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{null}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>;
  } as React.JSXElementConstructor<{ children: React.ReactElement }>;
}

describe("WalletDialog", () => {
  let config: any;

  beforeEach(async () => {
    const projectId = "test";

    config = createConfig({
      connectors: [
        walletConnect({
          projectId,
        }),
        injected(),
      ],
      chains: [mainnet, goerli],
      transports: {
        [mainnet.id]: http(),
        [goerli.id]: http(),
      },
    });
  });

  test("it works", async () => {
    render(<WalletDialog />, {
      // @ts-expect-error Incompatible wrapper type
      wrapper: WrapperGenerator(config),
    });

    const connectButton = screen.getByRole("button", {
      name: /Browser\sWallet/i,
    });
    userEvent.click(connectButton);
  });

  test("User should be able to see a changed account or network", async () => {
    // Simulate a connected wallet

    const invoice = {
      memo: "",
      amountInMinor: 100,
      recipientAddress: "0x0",
      extraFeeAddress: null,
      extraFeeBps: null,
      currency: "USD",
      coins: coinIdsToCoinConfig(["USDC-1", "USDC-10"]),
      excludedVenues: [],
      onComplete: () => {},
    } as Invoice;

    invoiceStore.getState().setInvoice(invoice);

    render(<ChainDialog selectChain={(_n?: number) => {}} />, {
      // @ts-expect-error Incompatible wrapper type
      wrapper: WrapperGenerator(config),
    });
  });
});
