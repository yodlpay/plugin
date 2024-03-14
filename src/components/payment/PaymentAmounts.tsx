import {
  CURRENCY_SYMBOL_SPECIAL_CASES,
  Decimal,
  formatPaymentAmount,
} from '@hiropay/common'
import { TokenInfo } from '@yodlpay/tokenlists'
import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useMainStore } from '../../contexts/useMainStore'
import { usePaymentStore } from '../../contexts/usePaymentStore'
import { useTokenStore } from '../../contexts/useTokenStore'
import { usePayment, useRawAmountIn, useTokenIsSameCurrency } from '../../hooks'
import {
  areCurrenciesEqual,
  determineTokenCurrency,
  getTokenOutInfo,
  normalizeBigInt,
} from '../../utils/helpers'
import { Amounts } from '../common/Amounts'

export type PaymentAmountsChildrenProps = {
  formattedSettlementAmount: string
  convertedAmountOut: string
  isSwapPayment: boolean
  formattedAmountIn: string
  convertedAmountIn: string
  tokenInfo: TokenInfo
  tokenOut: TokenInfo
  isSameCurrency: boolean
}

export type PaymentAmountsProps = {
  customChildren?: boolean
  children?: ({
    formattedSettlementAmount,
    convertedAmountOut,
    isSwapPayment,
    formattedAmountIn,
    convertedAmountIn,
    tokenInfo,
    tokenOut,
    isSameCurrency,
  }: PaymentAmountsChildrenProps) => JSX.Element
}

export const PaymentAmounts = ({
  customChildren = false,
  children = () => <></>,
}: PaymentAmountsProps) => {
  const bestSwap = usePaymentStore((state) => state.state.swapDetails?.bestSwap)

  const token = useMainStore((state) => state.token)

  const exchangeRates = useTokenStore((state) => state.exchangeRates)

  const { invoice } = usePayment()
  const { chain } = useAccount()

  const tokenInfo = useMemo(
    () => token?.tokenInfo ?? ({} as TokenInfo),
    [token?.tokenInfo],
  )

  const tokenHasCurrency = !!token?.tokenInfo.currency

  const isSameCurrency = useTokenIsSameCurrency()

  const isSwapPayment = !!bestSwap

  const isStablecoin = !CURRENCY_SYMBOL_SPECIAL_CASES.includes(invoice.currency)

  const priceFeed = usePaymentStore(
    (state) => state.state.priceFeedDetails?.data,
  )

  const { normalizedRawAmountIn } = useRawAmountIn()

  const tokenOut = getTokenOutInfo(invoice, chain)

  const tokenOutHasCurrency = !!tokenOut.currency

  const normalizedPriceFeedAmount = normalizeBigInt(
    priceFeed?.convertedAmount ?? 0n,
    priceFeed?.decimals ?? 0,
  )

  const tokenInExchangeRate =
    exchangeRates?.raw?.[token?.tokenInfo.coinGeckoId ?? '']?.[
      invoice?.currency.toLowerCase()
    ] ?? null

  const tokenOutExchangeRate = isSwapPayment
    ? exchangeRates?.raw?.[tokenOut.coinGeckoId ?? '']?.[
        invoice?.currency.toLowerCase()
      ] ?? null
    : tokenInExchangeRate

  const formattedAmountIn = useMemo(
    () =>
      `${formatPaymentAmount({
        amount: normalizedRawAmountIn,
        currency: tokenInfo.currency ?? tokenInfo.symbol,
        isFiatOrStablecoin: tokenHasCurrency,
      })}`,
    [
      normalizedRawAmountIn,
      tokenHasCurrency,
      tokenInfo.currency,
      tokenInfo.symbol,
    ],
  )

  const convertedAmountIn = useMemo(
    () =>
      !bestSwap && areCurrenciesEqual(invoice, token)
        ? ''
        : tokenInExchangeRate
        ? `~${formatPaymentAmount({
            amount: normalizedRawAmountIn * tokenInExchangeRate,
            currency: invoice.currency,
            isFiatOrStablecoin: isStablecoin,
          })}`
        : '',
    [
      bestSwap,
      tokenInExchangeRate,
      invoice,
      isStablecoin,
      normalizedRawAmountIn,
      token,
    ],
  )

  const settlementTokenAmount = isSwapPayment
    ? normalizeBigInt(bestSwap[0].amountOut, tokenOut.decimals)
    : !!priceFeed
    ? normalizedPriceFeedAmount
    : new Decimal(invoice.amountInMinor).dividedBy(new Decimal(100)).toNumber()

  const settlementTokenCurrency = determineTokenCurrency(
    !!bestSwap,
    token,
    tokenOut,
  )

  const formattedSettlementAmount = useMemo(
    () =>
      isSwapPayment || !!priceFeed
        ? `${isSwapPayment ? '~' : ''}${formatPaymentAmount({
            amount: settlementTokenAmount,
            currency: settlementTokenCurrency,
            isFiatOrStablecoin: isSwapPayment
              ? tokenOutHasCurrency
              : tokenHasCurrency,
          })}`
        : '',
    [
      isSwapPayment,
      priceFeed,
      settlementTokenAmount,
      settlementTokenCurrency,
      tokenHasCurrency,
      tokenOutHasCurrency,
    ],
  )

  const convertedAmountOut = useMemo(
    () =>
      !bestSwap && areCurrenciesEqual(invoice, token)
        ? ''
        : tokenOutExchangeRate
        ? `~${formatPaymentAmount({
            amount: settlementTokenAmount * tokenOutExchangeRate,
            currency: invoice.currency,
            isFiatOrStablecoin: isStablecoin,
          })}`
        : '',
    [
      bestSwap,
      invoice,
      token,
      tokenOutExchangeRate,
      settlementTokenAmount,
      isStablecoin,
    ],
  )

  return customChildren ? (
    children({
      formattedSettlementAmount,
      convertedAmountOut,
      isSwapPayment,
      formattedAmountIn,
      convertedAmountIn,
      tokenInfo,
      tokenOut,
      isSameCurrency,
    })
  ) : (
    <Amounts
      amountOut={formattedSettlementAmount}
      convertedAmountOut={convertedAmountOut}
      amountOutIcon={isSwapPayment ? tokenOut.logoUri : tokenInfo.logoUri}
      amountIn={formattedAmountIn}
      convertedAmountIn={convertedAmountIn}
      amountInIcon={tokenInfo.logoUri}
      isSameCurrency={isSameCurrency}
    />
  )
}
