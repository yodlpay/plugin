import { ChevronRightIcon, NoSymbolIcon } from "@heroicons/react/20/solid";
import {
  ErrorIndicator,
  Flex,
  LoadingIndicator,
  NavLink,
  RudderStackJSEvents,
  RudderStackJSPageCategories,
  RudderStackJSPageNames,
  useNavLinkStyles,
} from "@hiropay/common";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useMainStore } from "../contexts/useMainStore";
import { useAvailableChains } from "../hooks";

export type ChainDialogProps = {
  selectChain: (nid: number | undefined) => void;
};

export default function ChainDialog({ selectChain }: ChainDialogProps) {
  const { chain: currentChain } = useAccount();
  const chainsWithBalance = useMainStore((state) => state.chainsWithBalance);
  const eventCallback = useMainStore((state) => state.eventCallback);
  const pageCallback = useMainStore((state) => state.pageCallback);

  const { classes } = useNavLinkStyles();

  // Disallow chains that do not have a price feed for the invoice currency
  const { availableChains } = useAvailableChains();

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
