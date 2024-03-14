import { ArrowRightIcon } from '@heroicons/react/20/solid'
import {
  Flex,
  Text,
  formatPaymentAmount,
  usePaymentStyles,
} from '@hiropay/common'
import { getTokenBySymbol } from '@yodlpay/tokenlists'
import { Fragment, useState } from 'react'
import { useAccount } from 'wagmi'
import { useMainStore } from '../../contexts/useMainStore'
import { usePaymentStore } from '../../contexts/usePaymentStore'
import { usePayment, useSwappedTokens } from '../../hooks'
import {
  capitalizeWord,
  getTokenOutInfo,
  normalizeBigInt,
} from '../../utils/helpers'
import { Autoswap } from '../common/Autoswap'

export type PaymentAutoswapChildrenProps = {
  opened: boolean
  handleChange: (value: boolean) => void
  formattedSwapPath: JSX.Element | string
  formattedSwapRate: string
  formattedSwapVenue: string
  formattedPriceImpact: string
  formattedSlippage: string
  swapPathError: string | null
  swapPathLoading: boolean
  isSwapPayment: boolean
  renderSwapPath: (withLabel?: boolean) => JSX.Element
}

export type PaymentAutoswapProps = {
  customChildren?: boolean
  children?: ({
    opened,
    handleChange,
    formattedSwapPath,
    formattedSwapRate,
    formattedSwapVenue,
    formattedPriceImpact,
    formattedSlippage,
    swapPathError,
    swapPathLoading,
    isSwapPayment,
    renderSwapPath,
  }: PaymentAutoswapChildrenProps) => JSX.Element
}

export const PaymentAutoswap = ({
  customChildren = false,
  children = () => <></>,
}: PaymentAutoswapProps) => {
  const { invoice } = usePayment()
  const { chain } = useAccount()

  const token = useMainStore((state) => state.token)

  const bestSwap = usePaymentStore((state) => state.state.swapDetails?.bestSwap)

  const slippage = usePaymentStore(({ state }) => state.slippage)

  const tokenOut = getTokenOutInfo(invoice, chain)

  const isSwapPayment = !!bestSwap

  const swapVenue = isSwapPayment ? bestSwap[1] : undefined

  const [opened, setOpened] = useState(false)

  const {
    data,
    loading: swapPathLoading,
    error: swapPathError,
  } = useSwappedTokens()

  const swapQuote = isSwapPayment ? bestSwap[0] : undefined

  const normalizedSwapAmountIn = normalizeBigInt(
    swapQuote?.amountIn ?? 0n,
    token?.tokenInfo.decimals ?? 0,
  )

  const normalizedSwapAmountOut = normalizeBigInt(
    swapQuote?.amountOut ?? 0n,
    tokenOut.decimals ?? 0,
  )

  const tokenOutHasCurrency = !!tokenOut.currency

  const { classes } = usePaymentStyles()

  const handleChange = (value: boolean) => {
    setOpened(value)
  }

  const renderSwapPath = (withLabel = false) => (
    <Flex align="center">
      {data.map((token, index) => {
        const foundToken = getTokenBySymbol(token.symbol)
        const arrowIcon =
          index < data.length - 1 ? (
            <ArrowRightIcon width="16px" className={classes.swapArrowIcon} />
          ) : null

        if (!foundToken)
          return (
            <Fragment key={`swapPathToken-${token.address}`}>
              <Text c="primary.0" weight={500} size={13}>
                {token.symbol ?? 'N/A'}
              </Text>
              {arrowIcon}
            </Fragment>
          )

        return withLabel ? (
          <Fragment key={`swapPathToken-${token.address}`}>
            <Text
              c="primary.0"
              weight={500}
              size={13}
              mr={8}
              rightIcon={
                <img
                  key={token.address}
                  src={foundToken.logoUri}
                  alt="Token logo"
                  width="24px"
                  height="24px"
                />
              }
            >
              {token.symbol}
            </Text>
            {arrowIcon}
          </Fragment>
        ) : (
          <Fragment key={`swapPathLogo-${token.address}`}>
            <img
              src={foundToken.logoUri}
              alt="Token logo"
              width="16px"
              height="16px"
            />
            {arrowIcon}
          </Fragment>
        )
      })}
    </Flex>
  )

  const formattedSwapVenue = swapVenue ? capitalizeWord(swapVenue) : ''

  const formattedSlippage =
    !token?.isAccepted && slippage ? `${slippage * 100}%` : ''

  const formattedPriceImpact =
    !token?.isAccepted && bestSwap?.[0]
      ? `${(bestSwap?.[0].priceImpact ?? 0) * 100}%`
      : ''

  const formattedSwapPath = swapPathError
    ? 'Failed to fetch swap path'
    : swapPathLoading
    ? 'Fetching swap path'
    : renderSwapPath()

  const formattedSwapRate = swapQuote
    ? `${formatPaymentAmount({
        amount: normalizedSwapAmountOut / normalizedSwapAmountIn,
        isFiatOrStablecoin: tokenOutHasCurrency,
        shouldFormatCurrency: false,
      })} ${tokenOut.symbol}/${token?.tokenInfo.symbol}`
    : ''

  return customChildren
    ? children({
        opened,
        handleChange,
        formattedSwapPath,
        formattedSwapRate,
        formattedSwapVenue,
        formattedPriceImpact,
        formattedSlippage,
        swapPathError,
        swapPathLoading,
        isSwapPayment,
        renderSwapPath,
      })
    : isSwapPayment && (
        <Autoswap
          opened={opened}
          handleChange={handleChange}
          swapPath={formattedSwapPath}
          swapRate={formattedSwapRate}
          swapVenue={formattedSwapVenue}
          priceImpact={formattedPriceImpact}
          slippage={formattedSlippage}
          isError={swapPathError}
          isLoading={swapPathLoading}
          renderSwapPath={renderSwapPath}
        />
      )
}
