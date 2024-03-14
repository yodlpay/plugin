import { ChevronRightIcon, NoSymbolIcon } from '@heroicons/react/20/solid'
import {
  ErrorIndicator,
  Flex,
  LoadingIndicator,
  NavLink,
  RudderStackJSEvents,
  RudderStackJSPageCategories,
  RudderStackJSPageNames,
  useNavLinkStyles,
} from '@hiropay/common'
import { TokenInfo } from '@yodlpay/tokenlists'
import { useEffect } from 'react'
import { Chain } from 'viem'
import { useAccount } from 'wagmi'
import { useMainStore } from '../contexts/useMainStore'
import { useAvailableChains } from '../hooks'
import { CallbackAction, CallbackPage } from '../lib'

export type ChainChildrenProps = {
  currentChain: Chain | undefined
  sortedChains: {
    isDisabled: boolean
    tooltip: string
    tokens: TokenInfo[]
    router: string
    chainId: number
    chainName: string
    shortName: string
    logoUri: string
    explorerUrl: string
    rpcUrls: string[]
    wrappedNativeToken: string
    feeTreasury?: string | undefined
    testnet: boolean
    priceFeeds?:
      | {
          readonly [key: string]: string | undefined
        }
      | undefined
    curveRouterAddress?: string | undefined
  }[]
  handleClick: (chainId: number) => void
  eventCallback: (
    action: CallbackAction,
    params?: Record<string, unknown> | undefined,
  ) => void
  pageCallback: (
    category: RudderStackJSPageCategories.Payment,
    page: CallbackPage,
    params?: Record<string, unknown> | undefined,
  ) => void
}

export type ChainDialogProps = {
  customChildren?: boolean
  children?: ({
    currentChain,
    sortedChains,
    handleClick,
    eventCallback,
    pageCallback,
  }: ChainChildrenProps) => void
  selectChain: (nid: number | undefined) => void
}

export default function ChainDialog({
  customChildren = false,
  children = () => null,
  selectChain,
}: ChainDialogProps) {
  const { chain: currentChain } = useAccount()
  const chainsWithBalance = useMainStore((state) => state.chainsWithBalance)
  const eventCallback = useMainStore((state) => state.eventCallback)
  const pageCallback = useMainStore((state) => state.pageCallback)

  const { classes } = useNavLinkStyles()

  // Disallow chains that do not have a price feed for the invoice currency
  const { availableChains } = useAvailableChains()

  const sortedChains = availableChains.sort((a, b) => {
    // Sort by disabled status
    if (a.isDisabled && !b.isDisabled) {
      return 1
    }
    if (!a.isDisabled && b.isDisabled) {
      return -1
    }

    // Otherwise, they're equal
    return 0
  })

  const handleClick = (chainId: number) => {
    selectChain(chainId)
    eventCallback?.(RudderStackJSEvents.NetworkChosen, {
      networkId: chainId,
    })
  }

  useEffect(() => {
    pageCallback?.(
      RudderStackJSPageCategories.Payment,
      RudderStackJSPageNames.NetworkDialog,
      { chains: sortedChains.map((chain) => chain.chainName) },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (chainsWithBalance?.loading) {
    return <LoadingIndicator label="Loading chain balance details..." />
  }

  if (chainsWithBalance?.error) {
    return <ErrorIndicator error={chainsWithBalance?.error} />
  }

  return customChildren ? (
    children({
      currentChain,
      sortedChains,
      handleClick,
      eventCallback,
      pageCallback,
    })
  ) : (
    <>
      <Flex gap="24px" direction="column">
        {sortedChains.map((chain) => (
          <NavLink
            withIndicator={currentChain?.id === chain.chainId}
            indicatorProps={{ inline: true, color: 'green.6', offset: 5 }}
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
  )
}
