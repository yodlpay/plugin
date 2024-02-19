import {
  Button,
  Currency,
  Flex,
  InvoiceConfig,
  OnCompleteAction,
  OnCompleteActionType,
  coinIdsToCoinConfig,
  parseExcludedVenues,
  validateSearchParams,
} from "@hiropay/common";
import { useEffect, useState } from "react";
import { useMainStore } from "./contexts/useMainStore";
import { YodlSDKProvider, useYodlSDK } from "./wrappers/Provider";

function Content() {
  const searchParams = new URL(document.location.href).searchParams;
  const [config, setConfig] = useState<InvoiceConfig | null>(null);
  const [referrer, setReferrer] = useState<string | null>(null);

  const { amount, currency, isTestPayment } =
    validateSearchParams(searchParams);

  const logger = useMainStore((state) => state.logger);
  const flowInitiated = useMainStore((state) => state.flowInitiated);
  const colorScheme = useMainStore((state) => state.colorScheme);

  const { openModal } = useYodlSDK();

  const searchParamCoins = searchParams.get("coins");
  const excludedCoinsString = searchParams.get("excluded_coins");
  const excludedCoins = excludedCoinsString
    ? excludedCoinsString.split(",")
    : [];
  const coinIds: string[] = [
    "USDC-1",
    "USDC-10",
    "USDC-100",
    "USDC-137",
    "USDC-42161",
  ]
    .concat(searchParamCoins ? searchParamCoins.split(",") : [])
    .filter((coin) => !excludedCoins.includes(coin));
  // We want to send the payment to ourselves, but we don't know our address yet.
  // We will use 0x0 to indicate that we should replace it further down the line.
  const coinConfig = coinIdsToCoinConfig(coinIds);
  const excludedVenues = parseExcludedVenues(searchParams);

  useEffect(() => {
    const referrer = document.referrer;
    if (referrer.length > 0) {
      logger?.info(`Referrer is ${referrer}`);
      setReferrer(referrer);
    }
  }, [logger]);

  useEffect(() => {
    if (!config) {
      const invoiceConfig = {
        memo: searchParams.get("memo") ?? "",
        amountInMinor:
          currency !== Currency.ETH ? Math.floor(amount * 100) : amount * 100,
        recipientAddress: "0x0" as `0x${string}`,
        extraFeeAddress: null,
        extraFeeBps: null,
        currency: currency as string,
        coins: coinConfig,
        onCompleteAction: !!referrer
          ? ({
              type: "REDIRECT",
              payload: {
                url: referrer + "redirect",
              },
            } as OnCompleteAction)
          : ({ type: OnCompleteActionType.NOTHING } as OnCompleteAction),
      };

      setConfig(invoiceConfig);
    }
  }, [amount, coinConfig, config, currency, referrer, searchParams]);

  const handleClick = () => {
    openModal({
      config,
      isDemo: true,
      isTest: false,
      testnetMode: false,
      excludedVenues,
      localStorage,
      theme: colorScheme,
    });
    if (isTestPayment && amount === 42069) {
      throw Error("Test error triggered!");
    }
  };

  return !flowInitiated ? (
    <Flex align="center" justify="center" h="100vh">
      <Button data-testid="demo-payment" onClick={handleClick}>
        Demo Payment
      </Button>
    </Flex>
  ) : null;
}

function App() {
  return (
    <YodlSDKProvider>
      <Content />
    </YodlSDKProvider>
  );
}

export default App;
