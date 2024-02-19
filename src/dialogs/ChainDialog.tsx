import { ChevronRightIcon, NoSymbolIcon } from "@heroicons/react/20/solid";
import {
  CHAINS,
  CoinConfig,
  Currency,
  ErrorIndicator,
  Flex,
  LoadingIndicator,
  NavLink,
  PaymentType,
  RudderStackJSEvents,
  RudderStackJSPageCategories,
  RudderStackJSPageNames,
  coinIdToToken,
  useNavLinkStyles,
} from "@hiropay/common";
import { TokenInfo } from "@yodlpay/tokenlists";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useMainStore } from "../contexts/useMainStore";
import { usePayment } from "../hooks";
import { getPriceFeeds } from "../utils/priceFeedHelpers";

export type ChainDialogProps = {
  selectChain: (nid: number | undefined) => void;
};

export default function ChainDialog({ selectChain }: ChainDialogProps) {
  const { invoice } = usePayment();
  const { chain: currentChain } = useAccount();
  const chainsWithBalance = useMainStore((state) => state.chainsWithBalance);
  const eventCallback = useMainStore((state) => state.eventCallback);
  const pageCallback = useMainStore((state) => state.pageCallback);

  const { classes } = useNavLinkStyles();

  const chainIds = invoice.coins.map(
    (coinConfig: CoinConfig) => coinConfig.chainId
  );

  // Disallow chains that do not have a price feed for the invoice currency
  const availableChains = CHAINS.filter((chain) =>
    chainIds.includes(chain.chainId)
  ).map((chain) => {
    const chainConfig = invoice.coins.find(
      (config) => config.chainId === chain.chainId
    );
    const hasTokens = !!chainConfig?.tokens.length;
    const isDisabled =
      !hasTokens ||
      !chainConfig?.tokens.some((token) => {
        try {
          // Any non-error response from getPriceFeeds indicates that a
          // payment can be made for the invoice's currency and tokens
          const tokenInfo = coinIdToToken(
            `${token.symbol}-${chainConfig.chainId}`
          ) as TokenInfo;
          return !!tokenInfo
            ? !!getPriceFeeds(
                chain,
                invoice.currency as Currency,
                tokenInfo,
                PaymentType.DIRECT
              )
            : false;
        } catch (err) {
          return false;
        }
      });
    const hasBalance = chainsWithBalance?.data?.includes(chain.chainId);
    let tooltip = "";
    if (!hasTokens) {
      tooltip = "Insufficient recipient accepted token(s)";
    } else if (isDisabled) {
      tooltip = "Invoice currency unsupported";
    } else if (!hasBalance) {
      tooltip = "Insufficient funds";
    }
    return {
      ...chain,
      isDisabled: isDisabled || !hasBalance,
      tooltip,
    };
  });

  const sortedChains = availableChains.sort((a, b) => {
    // Sort by disabled status
    if (a.isDisabled && !b.isDisabled) {
      return 1;
    }
    if (!a.isDisabled && b.isDisabled) {
      return -1;
    }

    // Otherwise, they're equal
    return 0;
  });

  const handleClick = (chainId: number) => {
    selectChain(chainId);
    eventCallback?.(RudderStackJSEvents.NetworkChosen, {
      networkId: chainId,
    });
  };

  useEffect(() => {
    pageCallback?.(
      RudderStackJSPageCategories.Payment,
      RudderStackJSPageNames.NetworkDialog,
      { chains: sortedChains.map((chain) => chain.chainName) }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (chainsWithBalance?.loading) {
    return <LoadingIndicator label="Loading chain balance details..." />;
  }

  if (chainsWithBalance?.error) {
    return <ErrorIndicator error={chainsWithBalance?.error} />;
  }

  // STATE: SELECT BLOCKCHAIN
  return (
    <>
      <Flex gap="24px" direction="column">
        {sortedChains.map((chain) => (
          <NavLink
            withIndicator={currentChain?.id === chain.chainId}
            indicatorProps={{ inline: true, color: "green.6", offset: 5 }}
            key={chain.chainName}
            data-testid={`chain-${chain.chainId}`}
            size="md"
            label={chain.chainName}
            description={chain.tooltip}
            disabled={!!chain.isDisabled}
            icon={
              <img src={chain.logoUri} alt={chain.chainName} width="32px" />
            }
            rightIcon={
              chain.isDisabled ? (
                <NoSymbolIcon className={classes.disabledIcon} />
              ) : (
                <ChevronRightIcon className={classes.icon} />
              )
            }
            onClick={() => handleClick(chain.chainId)}
          />
        ))}
      </Flex>
    </>
  );
}
