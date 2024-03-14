import { ArrowLeftIcon, ChevronDownIcon } from '@heroicons/react/20/solid'
import { PowerIcon } from '@heroicons/react/24/outline'
import {
  ActionIcon,
  Badge,
  Button,
  CURRENCY_SYMBOL_SPECIAL_CASES,
  Decimal,
  Flex,
  Invoice,
  MOBILE_BREAKPOINT,
  Menu,
  RudderStackJSEvents,
  Select,
  Text,
  formatPaymentAmount,
} from '@hiropay/common'
import { createStyles, rem } from '@mantine/core'
import { TokenInfo } from '@yodlpay/tokenlists'
import { useMemo } from 'react'
import truncateEthAddress from 'truncate-eth-address'
import { Chain } from 'viem'
import { useAccount, useDisconnect } from 'wagmi'
import { useMainStore } from '../../contexts/useMainStore'
import { useAvailableChains, usePayment, useViewBasedState } from '../../hooks'

const EXCLUDED_HEADER_VIEWS = ['WelcomeDialog', 'StatusDialog']
const INCLUDED_CHAIN_VIEWS = ['TokenDialog', 'PaymentDialog']

type StylesProps = {
  onBackButtonClick: (() => void) | null
}

const useStyles = createStyles((theme, { onBackButtonClick }: StylesProps) => ({
  header: {
    background: theme.colors?.level?.[0],
    height: '114px',
    minHeight: '114px',
    width: 'auto',
    padding: `${rem(20)} ${rem(27)}`,
    borderBottom: `1px solid ${theme.colors?.level?.[2]}`,
    [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
      padding: rem(16),
    },
  },
  walletConnectNetworks: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    height: '28px',
    boxSizing: 'border-box',
    width: `${rem(52)} !important`,
    borderRadius: '14px',
    border: `1px solid ${theme.colors?.level?.[2]}`,
    background: theme.colors?.level?.[1],
    minHeight: 0,
    padding: 0,
    margin: 0,
    '&:hover': {
      background: theme.colors?.level?.[1],
    },
  },
  wrapper: {
    '&button:only-child': {
      marginLeft: 'auto',
    },
  },
  iconWrapper: {
    borderColor: theme.colors?.level?.[2],
    background: theme.colors?.level?.[1],
  },
  icon: {
    fill: theme.colors?.subtle?.[0],
    stroke: theme.colors?.subtle?.[0],
    strokeWidth: '0.8px',
  },
  label: {
    marginLeft: onBackButtonClick ? rem(16) : 0,
    fontSize: rem(20),
    fontWeight: 600,
    [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
      fontSize: rem(18),
      marginLeft: onBackButtonClick ? rem(28) : 0,
    },
  },
  info: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  address: {
    whiteSpace: 'nowrap',
  },
  badge: {
    height: '28px',
    borderRadius: '14px',
    border: `1px solid ${theme.colors?.level?.[2]}`,
    background: theme.colors?.level?.[1],
    fontSize: rem(14),
    fontWeight: 500,
    color: theme.colors?.subtle?.[0],
  },
  badgeIcon: {
    width: rem(16),
    stroke: theme.colors?.subtle?.[0],
    strokeWidth: '0.8px',
  },
  select: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    height: '28px',
    boxSizing: 'border-box',
    width: `${rem(52)} !important`,
    '& .mantine-Input-wrapper': {
      height: '28px',
      '&::before': {
        width: '20px',
        height: '20px',
      },
    },
    '& .mantine-Input-input': {
      borderRadius: '14px',
      border: `1px solid ${theme.colors?.level?.[2]}`,
      background: theme.colors?.level?.[1],
      height: '28px',
      minHeight: 0,
      width: '100%',
      padding: 0,
      margin: 0,
    },
    '& .mantine-Select-input:focus, & .mantine-Select-input:focus-within': {
      outline: '2px solid #228be6 !important',
      outlineOffset: '2px !important',
      border: `1px solid ${theme.colors?.level?.[2]}`,
    },
    '& > .mantine-Select-dropdown': {
      minWidth: `${rem(210)} !important`,
      [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
        left: `${rem(42)} !important`,
      },
    },
  },
  menu: {
    padding: '0.25rem',
    '& .mantine-Menu-item': {
      padding: 0,
    },
  },
  disconnectButton: {
    borderRadius: theme.radius.lg,
    color: theme.colors?.primary?.[0],
    height: '38px',
    padding: '8px 12px',
    fontSize: rem(14),
    fontWeight: 400,
  },
  disconnectIcon: {
    width: rem(14),
    stroke: theme.colors?.primary?.[0],
    strokeWidth: '2.5px',
  },
}))

export type HeaderChildrenProps = {
  onBackButtonClick: (() => void) | null
  handleBackButtonClick: () => void
  INCLUDED_CHAIN_VIEWS: string[]
  chainSelected: boolean
  chain: Chain | undefined
  availableChains: {
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
  handleNetworkChange: (chainId: string) => void
  chainLoading: boolean
  isConnected: boolean
  address: `0x${string}` | undefined
  truncateEthAddress: (address: string) => string
  handleWalletDisconnect: () => void
  invoice: Invoice
  formattedPayAmount: string
}

export type HeaderProps = {
  customChildren?: boolean
  children?: ({
    onBackButtonClick,
    handleBackButtonClick,
    INCLUDED_CHAIN_VIEWS,
    chainSelected,
    chain,
    availableChains,
    handleNetworkChange,
    chainLoading,
    isConnected,
    address,
    truncateEthAddress,
    handleWalletDisconnect,
    invoice,
    formattedPayAmount,
  }: HeaderChildrenProps) => JSX.Element
  view: JSX.Element | null
  resetChain: () => void
  resetToken: () => void
  selectChain: (chainId: number) => void
}

export const Header = ({
  customChildren = false,
  children = () => <></>,
  view,
  resetChain,
  resetToken,
  selectChain,
}: HeaderProps) => {
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()

  const { availableChains } = useAvailableChains()

  const chainLoading = useMainStore((state) => state.chainLoading)
  const chainSelected = useMainStore((state) => state.chainSelected)
  const eventCallback = useMainStore((state) => state.eventCallback)

  const { invoice } = usePayment()

  const { key, onBackButtonClick } = useViewBasedState(
    view,
    resetChain,
    resetToken,
  )

  const { classes } = useStyles({ onBackButtonClick })

  const isStablecoin = !CURRENCY_SYMBOL_SPECIAL_CASES.includes(invoice.currency)

  const formattedPayAmount = useMemo(
    () =>
      formatPaymentAmount({
        amount: new Decimal(invoice.amountInMinor)
          .dividedBy(new Decimal(100))
          .toNumber(),
        currency: invoice.currency,
        isFiatOrStablecoin: isStablecoin,
      }),
    [invoice.amountInMinor, invoice.currency, isStablecoin],
  )

  const handleNetworkChange = (chainId: string) => {
    eventCallback?.(RudderStackJSEvents.NetworkChanged, {
      networkId: chainId,
    })
    selectChain(parseInt(chainId))
  }

  const handleWalletDisconnect = () => {
    eventCallback?.(RudderStackJSEvents.WalletDisconnected)
    disconnect()
  }

  const handleBackButtonClick = () => {
    eventCallback?.(RudderStackJSEvents.BackButtonClicked)
    onBackButtonClick?.()
  }

  if (EXCLUDED_HEADER_VIEWS.includes(key)) return null

  return customChildren ? (
    children({
      onBackButtonClick,
      handleBackButtonClick,
      INCLUDED_CHAIN_VIEWS,
      chainSelected,
      chain,
      availableChains,
      handleNetworkChange,
      chainLoading,
      isConnected,
      address,
      truncateEthAddress,
      handleWalletDisconnect,
      invoice,
      formattedPayAmount,
    })
  ) : (
    <Flex
      direction="column"
      align="center"
      justify="space-between"
      className={classes.header}
    >
      <Flex align="center" justify="space-between" h="28px" w="100%" gap="16px">
        {onBackButtonClick && (
          <>
            <ActionIcon
              radius="xl"
              variant="outline"
              onClick={handleBackButtonClick}
              className={classes.iconWrapper}
            >
              <ArrowLeftIcon className={classes.icon} width="18px" />
            </ActionIcon>
            <Flex align="center" gap="8px">
              {INCLUDED_CHAIN_VIEWS.includes(key) && chainSelected ? (
                <Select
                  hideText
                  maxDropdownHeight={300}
                  value={chain?.id?.toString() ?? ''}
                  data={availableChains.map((chain) => ({
                    image: chain.logoUri,
                    label: chain.chainName,
                    value: chain.chainId.toString(),
                    disabled: chain.isDisabled,
                  }))}
                  onChange={handleNetworkChange}
                  isLoading={chainLoading}
                  size="sm"
                  className={classes.select}
                />
              ) : null}
              {isConnected && (
                <Menu
                  target={
                    <Badge
                      size="sm"
                      rightSection={
                        <ChevronDownIcon
                          width="16px"
                          className={classes.badgeIcon}
                        />
                      }
                      className={classes.badge}
                    >
                      {address ? truncateEthAddress(address) : 'Connect Wallet'}
                    </Badge>
                  }
                  data={[
                    {
                      id: 'disconnect',
                      item: (
                        <Button
                          leftIcon={
                            <PowerIcon
                              width="16px"
                              className={classes.disconnectIcon}
                            />
                          }
                          variant="link"
                          type="button"
                          onClick={handleWalletDisconnect}
                          fullWidth
                          className={classes.disconnectButton}
                        >
                          Disconnect
                        </Button>
                      ),
                    },
                  ]}
                  offset={8}
                  className={classes.menu}
                />
              )}
            </Flex>
          </>
        )}
      </Flex>
      <Flex align="center" justify="space-between" h="30px" w="100%" gap="16px">
        <Text c="subtle.0" size={20} weight={500} className={classes.info}>
          To:{' '}
          <Text
            c="primary.0"
            span
            size={20}
            weight={600}
            inherit
            className={classes.address}
          >
            {invoice.recipientHandle
              ? invoice.recipientHandle
              : truncateEthAddress(invoice.recipientAddress)}
          </Text>
        </Text>
        <Text c="primary.0" size={22} weight={600} className={classes.info}>
          {formattedPayAmount}
        </Text>
      </Flex>
    </Flex>
  )
}
