import {
  Button,
  DEFAULT_QUOTE,
  MaxUint256,
  RudderStackJSEvents,
  SwapVenue,
} from '@hiropay/common'
import { createStyles } from '@mantine/core'
import { enqueueSnackbar } from 'notistack'
import { useEffect, useMemo } from 'react'
import { Address } from 'viem'
import {
  useAccount,
  useBalance,
  usePublicClient,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { USER_DENIED_TX_MESSAGE } from '../../constants/messages'
import { useMainStore } from '../../contexts/useMainStore'
import { usePaymentStore } from '../../contexts/usePaymentStore'
import {
  useChainPriceFeed,
  usePayment,
  useSimulateTransaction,
} from '../../hooks'
import { CallbackAction } from '../../lib'
import {
  abiForToken,
  formatWagmiError,
  getTokenOutInfo,
  normalizeBigInt,
} from '../../utils/helpers'

const useStyles = createStyles(() => ({
  button: {
    width: '100%',
  },
}))

export type ApproveButtonChildrenProps = {
  isLoading: boolean
  isPreparing: boolean
  isDisabled: boolean
  isUnavailable: boolean | undefined
  handleClick: () => Promise<void>
  eventCallback: (
    action: CallbackAction,
    params?: Record<string, unknown> | undefined,
  ) => void
}

export type ApproveButtonProps = {
  customChildren?: boolean
  children?: ({
    isLoading,
    isPreparing,
    isDisabled,
    isUnavailable,
    handleClick,
    eventCallback,
  }: ApproveButtonChildrenProps) => JSX.Element
  allowance: {
    isLoading: boolean
    refetch: () => void
  }
}

export const ApproveButton = ({
  customChildren = false,
  children = () => <></>,
  allowance,
}: ApproveButtonProps) => {
  const { invoice } = usePayment()
  const { address, chain } = useAccount()

  const logger = useMainStore((state) => state.logger)
  const token = useMainStore((state) => state.token)
  const routerAddress = useMainStore((state) => state.routerAddress)
  const eventCallback = useMainStore((state) => state.eventCallback)

  const gasLoading = usePaymentStore((state) => state.state.gasDetails?.loading)

  const [nativeTokenPrice, nativeTokenPriceDecimals] = useChainPriceFeed(chain)

  const provider = usePublicClient()

  const tokenOut = getTokenOutInfo(invoice, chain)

  const sender = address ?? `0x`

  const contractArgs = {
    account: sender,
    address: token?.tokenInfo?.address as Address,
    abi: abiForToken(token?.tokenInfo?.symbol ?? '', chain?.id ?? -1),
    functionName: 'approve',
    args: [routerAddress, MaxUint256],
  }

  const tokenAbi = abiForToken(
    token?.tokenInfo?.symbol ?? '',
    chain ? chain.id : -1,
  )

  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    isFetching: isFetchingBalance,
  } = useBalance({
    address,
  })

  const {
    gas,
    gasPrice,
    gasInInvoiceCurrency,
    isLoading: isAllowanceLoading,
  } = useSimulateTransaction({
    contractArgs,
    provider,
    chain,
    nativeTokenPrice,
    nativeTokenPriceDecimals,
    tokenOut,
    invoice,
    routerAddress,
    quote: DEFAULT_QUOTE,
    venue: SwapVenue.NONE,
    priceFeedDetails: null,
  })

  const isApprovalBalanceSufficient = useMemo(
    () =>
      gasInInvoiceCurrency
        ? !!(
            normalizeBigInt(
              balanceData?.value ?? 0n,
              balanceData?.decimals ?? 0,
            ) -
            normalizeBigInt(gas * gasPrice, chain?.nativeCurrency.decimals ?? 1)
          )
        : true,
    [
      balanceData?.decimals,
      balanceData?.value,
      chain?.nativeCurrency.decimals,
      gas,
      gasInInvoiceCurrency,
      gasPrice,
    ],
  )

  const { classes } = useStyles()

  const contractParams = {
    address: token?.tokenInfo?.address as Address,
    abi: tokenAbi,
    functionName: 'approve',
    args: [routerAddress, MaxUint256],
  }

  const { isLoading: isPrepareLoading, isFetching: isPrepareFetching } =
    useSimulateContract(contractParams)

  const allowWrite = useWriteContract()
  const allowanceWriteTx = useWaitForTransactionReceipt({
    hash: allowWrite.data,
  })

  if (allowanceWriteTx.isSuccess) {
    allowance.refetch()
  }

  const isPreparing =
    isPrepareLoading ||
    isPrepareFetching ||
    gasLoading ||
    isAllowanceLoading ||
    isLoadingBalance ||
    isFetchingBalance

  const isLoading = allowWrite.isPending || allowanceWriteTx.isLoading

  const isUnavailable = isLoading || gasLoading

  const isDisabled =
    isUnavailable || !allowWrite.writeContract || !isApprovalBalanceSufficient

  const handleClick = async () => {
    eventCallback?.(RudderStackJSEvents.ApproveClicked)
    try {
      await allowWrite.writeContractAsync?.(contractParams)
    } catch (err: unknown) {
      if (err instanceof Error && 'details' in err) {
        if (err.details === USER_DENIED_TX_MESSAGE) {
          // The user rejected the transaction, we should track this, but not raise an exception
          logger?.warn('User rejected the transaction')
          eventCallback?.(RudderStackJSEvents.ApproveRejected)
        }
      }
      // We don't handle other errors, so we'll throw and let Sentry notify us
      throw err
    }
  }

  useEffect(() => {
    if (!isAllowanceLoading && !isApprovalBalanceSufficient) {
      enqueueSnackbar(
        formatWagmiError('Insufficient balance to cover gas fees', false),
        { variant: 'error' },
      )
    }
  }, [isApprovalBalanceSufficient, isAllowanceLoading])

  return customChildren ? (
    children({
      isLoading,
      isPreparing,
      isDisabled,
      isUnavailable,
      handleClick,
      eventCallback,
    })
  ) : (
    <Button
      c="onColor.0"
      color="brand.0"
      data-testid="approve"
      className={classes.button}
      disabled={isDisabled}
      onClick={handleClick}
      loading={isUnavailable}
      fullWidth
    >
      {isLoading ? 'Approving' : isPreparing ? 'Preparing' : 'Approve'}
    </Button>
  )
}
