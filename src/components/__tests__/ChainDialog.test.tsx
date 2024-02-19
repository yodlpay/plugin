import { Invoice, coinIdsToCoinConfig } from "@hiropay/common";
import { render, screen } from "@testing-library/react";
import { goerli } from "viem/chains";
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import "wagmi/window";
import WrapperGenerator from "../../components/__tests__/WrapperGenerator";
import { invoiceStore } from "../../contexts/useInvoiceStore";
import ChainDialog from "../../dialogs/ChainDialog";

describe("ChainDialog", () => {
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

  test("it displays chains from accepted tokens", async () => {
    const coinIds = ["USDC-1", "USDC-10"];
    const coinConfigs = coinIdsToCoinConfig(coinIds);
    const invoice = {
      memo: "",
      amountInMinor: 100,
      recipientAddress: "0x0",
      extraFeeAddress: null,
      extraFeeBps: null,
      currency: "USD",
      coins: coinConfigs,
      excludedVenues: [],
      onComplete: () => {},
    } as Invoice;

    invoiceStore.getState().setInvoice(invoice);

    render(<ChainDialog selectChain={(_n?: number) => {}} />, {
      wrapper: WrapperGenerator(config),
    });

    await screen.findByTestId("chain-1");
    await screen.findByTestId("chain-10");
    // Not in the coinIds list:
    // @ts-expect-error Property 'toBeInTheDocument' does not exist on type 'Matchers<void, any>'.ts(2339)
    expect(screen.queryByTestId("chain-42161")).not.toBeInTheDocument();
  });
});
