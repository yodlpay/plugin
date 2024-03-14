import {
  ChevronDownIcon,
  ChevronRightIcon,
  NoSymbolIcon,
} from '@heroicons/react/20/solid'
import {
  Accordion,
  Button,
  CURRENCY_TO_SYMBOL,
  ErrorIndicator,
  ExchangeRate,
  Flex,
  Invoice,
  LoadingIndicator,
  MOBILE_BREAKPOINT,
  NavLink,
  RudderStackJSEvents,
  RudderStackJSPageCategories,
  RudderStackJSPageNames,
  Text,
  TokenHeld,
  Tooltip,
  WarningIndicator,
  coinIdToToken,
  useNavLinkStyles,
  usePaymentStyles,
} from '@hiropay/common'
import { clsx, createStyles } from '@mantine/core'
import {
  ArrowBendUpLeft,
  Info,
  LinkBreak,
  Shuffle,
} from '@phosphor-icons/react'
import { TokenInfo, getTokens } from '@yodlpay/tokenlists'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Address } from 'viem'
import { useAccount, useDisconnect } from 'wagmi'
import { useMainStore } from '../contexts/useMainStore'
import { useTokenStore } from '../contexts/useTokenStore'
import {
  useAvailableTokens,
  usePayment,
  useTokenBalances,
  useTokenPrices,
} from '../hooks'
import { CallbackAction, CallbackPage } from '../lib'
import {
  areCurrenciesEqual,
  formatBalance,
  formatConvertedBalance,
  isBalanceSufficient,
} from '../utils/helpers'

const useStyles = createStyles((theme) => ({
  accordion: {
    marginTop: '16px',
    height: '100%',
    transition: 'max-height 500ms ease',
    '& > :nth-of-type(1)': {
      '& .mantine-Accordion-label': {
        paddingTop: 0,
      },
    },
    '& > :nth-of-type(2)': {
      transition: 'transform 500ms ease',
      background: theme.colors?.level?.[0],
      [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
        padding: '6px 12px',
      },
      '& > .mantine-Accordion-control': {
        [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
          padding: '0px',
        },
      },
      '& > .mantine-Accordion-panel': {
        '& .mantine-Accordion-content': {
          [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
            paddingLeft: '0px',
            paddingRight: '0px',
          },
        },
      },
    },
    '& .mantine-Accordion-control': {
      height: '54px',
      padding: '15px 8px',
      borderRadius: theme.radius.md,
      background: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    '& .mantine-Accordion-label': {
      paddingBottom: 0,
      flex: 'none',
    },
    '& .mantine-Accordion-chevron': {
      marginLeft: '0.75rem',
    },
    '& .mantine-Accordion-item[data-active]': {
      background: 'transparent',
    },
  },
  tooltipIcon: {
    marginLeft: '4px',
    fill: theme.colors?.subtle?.[0],
  },
  chevronIcon: {
    minWidth: '32px',
    fill: theme.colors?.disabled?.[0],
  },
  leftLine: {
    height: '1px',
    flex: 1,
    backgroundImage:
      'linear-gradient(to right, rgba(10, 80, 255, 0), rgba(232, 89, 12, 1))',
  },
  rightLine: {
    height: '1px',
    flex: 1,
    backgroundImage:
      'linear-gradient(to right, rgba(0, 73, 255, 1), rgba(232, 139, 12, 0))',
  },
  infoIcon: {
    color: 'rgba(0, 73, 255, 1)',
    stroke: 'rgba(0, 73, 255, 1)',
    strokeWidth: '6px',
  },
  avatar: {
    backgroundColor: 'transparent',
    border: '0.125rem solid transparent',
  },
  avatarIndicator: {
    background: theme.colors?.level?.[0],
  },
  shuffleLabel: {
    marginLeft: '4px',
  },
  shuffleIndicator: {
    marginLeft: '4px',
  },
}))

export type TokenChildrenProps = {
  isLoading: boolean
  isBalancesError: string | null | undefined
  containsAcceptedTokens: boolean
  containsSwappableTokens: boolean
  acceptedTokensWithSufficientBalance: TokenHeld[] | undefined
  swappableTokensWithSufficientBalance: TokenHeld[] | undefined
  invoice: Invoice
  exchangeRates: ExchangeRate | null
  tokensWithInsufficientBalance: TokenHeld[]
  formatBalance: (balance: bigint, decimals: number, symbol?: string) => string
  areCurrenciesEqual: (invoice: Invoice, token: TokenHeld | null) => boolean
  renderConvertedBalance: (token: TokenHeld) => JSX.Element
  handleNavlinkClick: (token: TokenHeld) => void
  handleNetworkClick: () => Promise<void>
  handleItemChange: (value: string | null | unknown) => void
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

export type TokenDialogProps = {
  customChildren?: boolean
  children?: ({
    isLoading,
    isBalancesError,
    containsAcceptedTokens,
    containsSwappableTokens,
    acceptedTokensWithSufficientBalance,
    swappableTokensWithSufficientBalance,
    invoice,
    exchangeRates,
    tokensWithInsufficientBalance,
    formatBalance,
    areCurrenciesEqual,
    renderConvertedBalance,
    handleNavlinkClick,
    handleNetworkClick,
    handleItemChange,
    eventCallback,
    pageCallback,
  }: TokenChildrenProps) => void
}

export default function TokenDialog({
  customChildren = false,
  children = () => null,
}: TokenDialogProps) {
  const [expandedItem, setExpandedItem] = useState<string | undefined>(
    undefined,
  )

  const { invoice } = usePayment()
  const { address, chain } = useAccount()
  const { disconnectAsync } = useDisconnect()

  const { classes } = useStyles()
  const { classes: paymentClasses } = usePaymentStyles()
  const { classes: navLinkClasses } = useNavLinkStyles()

  const setToken = useMainStore((state) => state.setToken)

  const exchangeRates = useTokenStore((state) => state.exchangeRates)
  const routerVersion = useMainStore((state) => state.routerVersion)
  const chainDataAPI = useMainStore((state) => state.chainDataAPI)
  const eventCallback = useMainStore((state) => state.eventCallback)
  const pageCallback = useMainStore((state) => state.pageCallback)

  const noDataSharedProps = {
    labelSize: 14,
    labelBold: true,
    iconSize: 32,
    horizontal: true,
    horizontalMargin: 16,
    verticalMargin: 0,
    padding: '8px 16px',
    backgroundShade: 0,
  }

  const { acceptedTokens, swappableTokens } = useAvailableTokens()

  const chainTokens = useMemo(
    () => (chain?.id ? getTokens(chain?.id) : []),
    [chain?.id],
  )

  const invoiceTokens = useMemo(() => {
    const chainConfig = invoice.coins.find(
      (coinConfig) => coinConfig.chainId == chain?.id,
    )
    if (chainConfig) {
      return chainConfig.tokens.map((token) =>
        coinIdToToken(`${token.symbol}-${chain?.id}`),
      ) as TokenInfo[]
    } else {
      return []
    }
  }, [chain?.id, invoice.coins])

  const filteredTokens = useMemo(
    () =>
      routerVersion == '0.1' // we do not support swaps in v0.1
        ? chainTokens.filter((tokenInfo) =>
            invoiceTokens.some(
              (invoiceToken: TokenInfo) =>
                invoiceToken.address == tokenInfo.address,
            ),
          )
        : chainTokens,
    [chainTokens, invoiceTokens, routerVersion],
  )

  const renderConvertedBalance = useCallback(
    (token: TokenHeld) => {
      if (exchangeRates?.error)
        return (
          <Text
            size={14}
            ml={4}
            icon={<LinkBreak color="subtle.0" size="14px" />}
          >
            {`${
              CURRENCY_TO_SYMBOL[
                invoice.currency as keyof typeof CURRENCY_TO_SYMBOL
              ]?.symbol || ''
            }_.__`}
          </Text>
        )
      const { isLoading, formattedAmount } = formatConvertedBalance(
        token,
        exchangeRates?.data?.[token.tokenInfo.symbol],
        invoice,
      )
      if (isLoading) {
        return (
          <LoadingIndicator
            label="Converting"
            horizontal
            shouldGrow={false}
            verticalMargin={0}
            horizontalMargin={4}
            labelSize={14}
            spinnerSize={14}
          />
        )
      }
      return <>{formattedAmount}</>
    },
    [exchangeRates, invoice],
  )

  const handleItemChange = (value: string | null | unknown) => {
    setExpandedItem(value as string)
  }

  const handleNetworkClick = async () => {
    await disconnectAsync()
  }

  const handleNavlinkClick = (token: TokenHeld) => {
    if (isBalanceSufficient(token, invoice, exchangeRates)) {
      setToken(token)
      eventCallback?.(RudderStackJSEvents.TokenChosen, {
        token: token.tokenInfo.symbol,
      })
    }
  }

  const { isLoading: isLoadingPrices, error: isPricesError } =
    useTokenPrices(filteredTokens)

  const { isLoading: isLoadingBalances, error: isBalancesError } =
    useTokenBalances(chainDataAPI, chain?.id, address as Address, invoiceTokens)

  const tokensWithInsufficientBalance = [
    ...(acceptedTokens ?? []),
    ...(swappableTokens ?? []),
  ].filter((token) => !isBalanceSufficient(token, invoice, exchangeRates))

  const acceptedTokensWithSufficientBalance = acceptedTokens?.filter(
    (token) => !!isBalanceSufficient(token, invoice, exchangeRates),
  )
  const swappableTokensWithSufficientBalance = swappableTokens?.filter(
    (token) => !!isBalanceSufficient(token, invoice, exchangeRates),
  )

  const containsAcceptedTokens =
    (acceptedTokensWithSufficientBalance?.length ?? 0) > 0
  const containsSwappableTokens =
    (swappableTokensWithSufficientBalance?.length ?? 0) > 0

  const isLoading =
    isLoadingBalances ||
    isLoadingPrices ||
    !exchangeRates ||
    exchangeRates?.loading

  useEffect(() => {
    if (!isLoading && !isBalancesError && !isPricesError) {
      pageCallback?.(
        RudderStackJSPageCategories.Payment,
        RudderStackJSPageNames.TokenDialog,
        {
          preferredTokens:
            acceptedTokensWithSufficientBalance?.map(
              (token) => token.tokenInfo.symbol,
            ) ?? [],
          swappableTokens:
            swappableTokensWithSufficientBalance?.map(
              (token) => token.tokenInfo.symbol,
            ) ?? [],
          insufficientBalanceTokens:
            tokensWithInsufficientBalance?.map(
              (token) => token.tokenInfo.symbol,
            ) ?? [],
        },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  return customChildren ? (
    children({
      isLoading,
      isBalancesError,
      containsAcceptedTokens,
      containsSwappableTokens,
      acceptedTokensWithSufficientBalance,
      swappableTokensWithSufficientBalance,
      invoice,
      exchangeRates,
      tokensWithInsufficientBalance,
      formatBalance,
      areCurrenciesEqual,
      renderConvertedBalance,
      handleNavlinkClick,
      handleNetworkClick,
      handleItemChange,
      eventCallback,
      pageCallback,
    })
  ) : (
    <Flex grow={1} direction="column" gap="16px">
      {isLoading ? (
        <LoadingIndicator label="Loading tokens..." />
      ) : !!isBalancesError ? (
        <ErrorIndicator error={isBalancesError} />
      ) : (
        <Flex direction="column">
          {containsAcceptedTokens || containsSwappableTokens ? (
            <Flex direction="column" gap="16px">
              {containsAcceptedTokens ? (
                acceptedTokensWithSufficientBalance?.map((token) => {
                  const isDisabled = !isBalanceSufficient(
                    token,
                    invoice,
                    exchangeRates,
                  )

                  return (
                    <NavLink
                      key={`${token.tokenInfo.name}-accepted-navlink`}
                      size="sm"
                      label={token.tokenInfo.symbol}
                      description={token.tokenInfo.name}
                      disabled={isDisabled}
                      icon={
                        <img
                          src={token.tokenInfo.logoUri}
                          alt={token.tokenInfo.name}
                          width="32px"
                          height="32px"
                        />
                      }
                      rightLabel={formatBalance(
                        token.balance,
                        token.tokenInfo.decimals,
                        token.tokenInfo.symbol,
                      )}
                      rightDescription={
                        !areCurrenciesEqual(invoice, token) &&
                        renderConvertedBalance(token)
                      }
                      rightIcon={
                        isDisabled ? (
                          <NoSymbolIcon
                            className={navLinkClasses.disabledIcon}
                          />
                        ) : (
                          <ChevronRightIcon className={navLinkClasses.icon} />
                        )
                      }
                      onClick={() => handleNavlinkClick(token)}
                    />
                  )
                })
              ) : (
                <Flex direction="column">
                  <WarningIndicator
                    label="No preferred tokens available"
                    description="You don’t have any sufficient balance to pay with a preferred token"
                    {...noDataSharedProps}
                  />
                </Flex>
              )}

              <Flex h={36} align="center" justify="center" gap="8px">
                <Flex className={classes.leftLine} />
                <Text
                  className={paymentClasses.autoswapLabel}
                  icon={
                    <Shuffle size={18} className={paymentClasses.shuffleIcon} />
                  }
                  rightIcon={
                    <Tooltip label="These tokens will be automatically swapped en route to recipient">
                      <Info size={18} className={classes.infoIcon} />
                    </Tooltip>
                  }
                >
                  Autoswap
                </Text>
                <Flex className={classes.rightLine} />
              </Flex>

              {containsSwappableTokens ? (
                swappableTokensWithSufficientBalance?.map((token) => {
                  const isDisabled = !isBalanceSufficient(
                    token,
                    invoice,
                    exchangeRates,
                  )

                  return (
                    <NavLink
                      key={`${token.tokenInfo.name}-swappable-navlink`}
                      size="sm"
                      label={
                        <Flex align="center">
                          <Text>{token.tokenInfo.symbol}</Text>
                          {!token.isAccepted && (
                            <Shuffle
                              size={18}
                              className={classes.shuffleLabel}
                            />
                          )}
                        </Flex>
                      }
                      description={token.tokenInfo.name}
                      disabled={isDisabled}
                      icon={
                        <img
                          src={token.tokenInfo.logoUri}
                          alt={token.tokenInfo.name}
                          width="32px"
                          height="32px"
                        />
                      }
                      rightLabel={formatBalance(
                        token.balance,
                        token.tokenInfo.decimals,
                        token.tokenInfo.symbol,
                      )}
                      rightDescription={
                        !areCurrenciesEqual(invoice, token) &&
                        renderConvertedBalance(token)
                      }
                      rightIcon={
                        isDisabled ? (
                          <NoSymbolIcon
                            className={navLinkClasses.disabledIcon}
                          />
                        ) : (
                          <ChevronRightIcon className={navLinkClasses.icon} />
                        )
                      }
                      onClick={() => handleNavlinkClick(token)}
                    />
                  )
                })
              ) : (
                <Flex direction="column">
                  <WarningIndicator
                    label="No autoswap tokens available"
                    description="You don’t have any sufficient balance to pay with an autoswap token"
                    {...noDataSharedProps}
                  />
                </Flex>
              )}
            </Flex>
          ) : (
            <Flex direction="column">
              <WarningIndicator
                label="No tokens available"
                description="You don’t have sufficient balances to pay with any tokens. Please change to different network"
                {...noDataSharedProps}
              />
              <Button
                c="onColor.0"
                color="brand.0"
                mt={32}
                onClick={handleNetworkClick}
                leftIcon={<ArrowBendUpLeft size={20} />}
              >
                Switch network
              </Button>
            </Flex>
          )}
          {(containsAcceptedTokens || containsSwappableTokens) &&
            tokensWithInsufficientBalance.length > 0 && (
              <Accordion
                defaultValue={expandedItem}
                value={expandedItem}
                variant="filled"
                chevron={
                  <ChevronDownIcon
                    className={clsx(navLinkClasses.icon, classes.chevronIcon)}
                  />
                }
                onChange={handleItemChange}
                className={classes.accordion}
                data={[
                  {
                    value: 'insufficient',
                    label: (
                      <Flex align="center" justify="space-between">
                        <Flex
                          direction="column"
                          align="flex-start"
                          justify="center"
                          ml={12}
                        >
                          <Text c="subtle.0" weight={500} size={14}>
                            Insufficient balances
                          </Text>
                        </Flex>
                      </Flex>
                    ),
                    content: (
                      <Flex direction="column" gap={16}>
                        {tokensWithInsufficientBalance?.map((token) => (
                          <NavLink
                            key={`${token.tokenInfo.name}-insufficient-navlink`}
                            size="sm"
                            label={
                              <Flex align="center">
                                <Text>{token.tokenInfo.symbol}</Text>
                                {!token.isAccepted && (
                                  <Shuffle
                                    size={18}
                                    className={classes.shuffleIndicator}
                                  />
                                )}
                              </Flex>
                            }
                            description={token.tokenInfo.name}
                            disabled={true}
                            icon={
                              <img
                                src={token.tokenInfo.logoUri}
                                alt={token.tokenInfo.name}
                                width="32px"
                                height="32px"
                              />
                            }
                            rightLabel={formatBalance(
                              token.balance,
                              token.tokenInfo.decimals,
                              token.tokenInfo.symbol,
                            )}
                            rightDescription={
                              !areCurrenciesEqual(invoice, token) &&
                              renderConvertedBalance(token)
                            }
                          />
                        ))}
                      </Flex>
                    ),
                  },
                ]}
              />
            )}
        </Flex>
      )}
    </Flex>
  )
}
