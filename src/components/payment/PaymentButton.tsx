import { Button, RudderStackJSEvents } from '@hiropay/common'
import { createStyles } from '@mantine/core'
import { TokenInfo } from '@yodlpay/tokenlists'
import { enqueueSnackbar } from 'notistack'
import { useEffect } from 'react'
import {
  useAccount,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { USER_DENIED_TX_MESSAGE } from '../../constants/messages'
import { useMainStore } from '../../contexts/useMainStore'
import { usePaymentStore } from '../../contexts/usePaymentStore'
import {
  useFetchPayload,
  useIsBalanceSufficientToCoverGas,
  usePayment,
} from '../../hooks'
import { CallbackAction } from '../../lib'
import { formatWagmiError } from '../../utils/helpers'
import { getRouterAbi } from '../../utils/priceFeedHelpers'

const useStyles = createStyles(() => ({
  button: {
    width: '100%',
  },
}))

export type PaymentButtonChildrenProps = {
  isPaymentLoading: boolean
  isPreparing: boolean | undefined
  isDisabled: boolean
  isUnavailable: boolean | undefined
  handlePaymentClick: () => Promise<void>
  eventCallback: (
    action: CallbackAction,
    params?: Record<string, unknown> | undefined,
  ) => void
}

export type PaymentButtonProps = {
  customChildren?: boolean
  children?: ({
    isPaymentLoading,
    isPreparing,
    isDisabled,
    isUnavailable,
    handlePaymentClick,
    eventCallback,
  }: PaymentButtonChildrenProps) => JSX.Element
  rawAmountIn: bigint | undefined
}

export const PaymentButton = ({
  customChildren = false,
  children = () => <></>,
  rawAmountIn,
}: PaymentButtonProps) => {
  const gasLoading = usePaymentStore((state) => state.state.gasDetails?.loading)
  const priceFeedDetails = usePaymentStore(
    (state) => state.state.priceFeedDetails,
  )
  const bestSwap = usePaymentStore((state) => state.state.swapDetails?.bestSwap)
  const remainderDetails = usePaymentStore(
    (state) => state.state.remainderDetails,
  )

  const isSwapPayment = !!bestSwap

  const swapQuote = isSwapPayment ? bestSwap[0] : undefined
  const swapVenue = isSwapPayment ? bestSwap[1] : undefined
  const returnRemainder = !!remainderDetails
    ? remainderDetails.shouldReturnRemainder
    : false

  const { invoice } = usePayment()
  const { chain } = useAccount()

  const { classes } = useStyles()

  const logger = useMainStore((state) => state.logger)
  const token = useMainStore((state) => state.token)
  const setTransaction = useMainStore((state) => state.setTransaction)
  const routerVersion = useMainStore((state) => state.routerVersion)
  const routerAddress = useMainStore((state) => state.routerAddress)
  const eventCallback = useMainStore((state) => state.eventCallback)

  const {
    isSufficient: isGasBalanceSufficient,
    isLoading: isGasBalanceLoading,
  } = useIsBalanceSufficientToCoverGas()

  const [isLoading, isFetchError, payload, fetchError] = useFetchPayload(
    token?.tokenInfo as TokenInfo,
    invoice,
    swapQuote,
    swapVenue,
    returnRemainder,
    priceFeedDetails?.data ?? null,
    rawAmountIn,
  )

  const routerAbi = getRouterAbi(routerVersion)

  const contractParams = {
    address: routerAddress,
    abi: routerAbi,
    functionName: payload.contractFunctionName,
    args: payload.contractArgs,
    value: payload.value,
  }

  const {
    isLoading: isPrepareLoading,
    isFetching: isPrepareFetching,
    isError: isPrepareError,
    error: prepareError,
  } = useSimulateContract(contractParams)

  const payment = useWriteContract()

  const paymentTx = useWaitForTransactionReceipt({
    hash: payment.data,
  })

  if (paymentTx.isSuccess) {
    if (paymentTx?.data?.status === 'success') {
      if (payment.data && chain) {
        setTransaction({
          data: {
            hash: payment.data,
            chain: chain,
            receipt: paymentTx.data,
            confirmed: false,
          },
          loading: false,
          error: null,
        })
      }
    } else {
      setTransaction({
        data: null,
        loading: false,
        error: 'Transaction reverted',
      })
    }
  }

  if (paymentTx.isError) {
    setTransaction({
      data: null,
      loading: false,
      error:
        formatWagmiError(paymentTx.error, false) ?? 'Error sending payment',
    })
  }

  const handlePaymentClick = async () => {
    eventCallback?.(RudderStackJSEvents.PayClicked)
    try {
      await payment.writeContractAsync?.(contractParams)
    } catch (err: unknown) {
      if (err instanceof Error && 'details' in err) {
        if (err.details === USER_DENIED_TX_MESSAGE) {
          // The user rejected the transaction, we should track this, but not raise an exception
          logger?.warn('User rejected the transaction')
          eventCallback?.(RudderStackJSEvents.PayRejected)
        }
      }
      // We don't handle other errors, so we'll throw and let Sentry notify us
      throw err
    }
  }

  const isPreparing =
    isPrepareLoading || isPrepareFetching || isLoading || gasLoading

  const isPaymentLoading = payment.isPending || paymentTx.isLoading

  const isUnavailable = isPaymentLoading || isPreparing

  const isDisabled =
    isUnavailable || !payment.writeContract || !isGasBalanceSufficient

  useEffect(() => {
    if (isFetchError || isPrepareError || payment.isError) {
      enqueueSnackbar(
        formatWagmiError(fetchError ?? prepareError ?? payment.error),
        { variant: 'error' },
      )
    }
  }, [
    fetchError,
    isFetchError,
    isPrepareError,
    payment.error,
    payment.isError,
    prepareError,
  ])

  useEffect(() => {
    if (!isGasBalanceLoading && !isGasBalanceSufficient) {
      enqueueSnackbar(
        formatWagmiError('Insufficient balance to cover gas fees', false),
        { variant: 'error' },
      )
    }
  }, [isGasBalanceLoading, isGasBalanceSufficient])

  return customChildren ? (
    children({
      isPaymentLoading,
      isPreparing,
      isDisabled,
      isUnavailable,
      handlePaymentClick,
      eventCallback,
    })
  ) : (
    <Button
      c="onColor.0"
      color="brand.0"
      data-testid="confirm-payment"
      className={classes.button}
      disabled={isDisabled}
      onClick={handlePaymentClick}
      loading={isUnavailable}
      fullWidth
    >
      {isPaymentLoading ? 'Paying' : isPreparing ? 'Preparing' : 'Pay'}
    </Button>
  )
}
