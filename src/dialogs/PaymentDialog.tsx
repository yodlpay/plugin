import {
  ErrorIndicator,
  Flex,
  LoadingIndicator,
  LoadingState,
  RudderStackJSPageCategories,
  RudderStackJSPageNames,
  WarningIndicator,
  usePaymentStyles,
} from '@hiropay/common';
import { clsx } from '@mantine/core';
import { GetBalanceReturnType } from '@wagmi/core';
import { TokenInfo } from '@yodlpay/tokenlists';
import React, { useEffect, useMemo } from 'react';
import {
  Address,
  GetBalanceErrorType,
  ReadContractErrorType,
  erc20Abi,
} from 'viem';
import {
  UseBalanceReturnType,
  useAccount,
  useBalance,
  useReadContract,
} from 'wagmi';
import { ApproveButton } from '../components/payment/ApproveButton';
import { PaymentAmounts } from '../components/payment/PaymentAmounts';
import { PaymentAutoswap } from '../components/payment/PaymentAutoswap';
import { PaymentButton } from '../components/payment/PaymentButton';
import { PaymentFooter } from '../components/payment/PaymentFooter';
import { PaymentHeader } from '../components/payment/PaymentHeader';
import { useMainStore } from '../contexts/useMainStore';
import { usePaymentStore } from '../contexts/usePaymentStore';
import {
  useChainPriceFeed,
  useDynamicLoadingLabel,
  useGetDirectPaymentAmount,
  useGetDirectPaymentGasDetails,
  useGetEstimates,
  useGetQuotes,
  useLoadingState,
} from '../hooks';
import { CallbackPage } from '../lib';
import { actions } from '../reducers/payment';
import { isAllowanceSufficient } from '../utils/helpers';

export type PaymentDialogChildrenProps = {
  state: string;
  rawAmountIn: bigint | undefined;
  allowance: {
    isLoading: boolean;
    isFetching: boolean;
    data:
      | { decimals: number; formatted: string; symbol: string; value: bigint }
      | undefined
      | bigint;
    error: GetBalanceErrorType | ReadContractErrorType | null;
  };
  isCalculatingPayment: boolean;
  loadingLabel: string;
  nativeTokenPrice: bigint | undefined;
  tokenInfo: TokenInfo;
  allowanceNativeToken: UseBalanceReturnType<{
    decimals: number;
    formatted: string;
    symbol: string;
    value: bigint;
  }>;
  renderedIndicator: JSX.Element;
  pageCallback: (
    category: RudderStackJSPageCategories.Payment,
    page: CallbackPage,
    params?: Record<string, unknown> | undefined,
  ) => void;
};

export type PaymentDialogProps = {
  customChildren?: boolean;
  children?: ({
    state,
    rawAmountIn,
    allowance,
    isCalculatingPayment,
    loadingLabel,
    nativeTokenPrice,
    tokenInfo,
    allowanceNativeToken,
    renderedIndicator,
    pageCallback,
  }: PaymentDialogChildrenProps) => JSX.Element;
};

function PaymentDialog({
  customChildren = false,
  children = () => <></>,
}: PaymentDialogProps) {
  const directPaymentLoading = usePaymentStore(
    (state) => state.state.directPaymentDetails?.loading,
  );
  const directPaymentError = usePaymentStore(
    (state) => state.state.directPaymentDetails?.error,
  );
  const directPaymentAmountIn = usePaymentStore(
    (state) => state.state.directPaymentDetails?.data,
  );
  const swapLoading = usePaymentStore(
    (state) => state.state.swapDetails?.loading,
  );
  const swapError = usePaymentStore((state) => state.state.swapDetails?.error);
  const swapQuotes = usePaymentStore(
    (state) => state.state.swapDetails?.swapQuotes,
  );
  const bestSwap = usePaymentStore(
    (state) => state.state.swapDetails?.bestSwap,
  );
  const allowanceError = usePaymentStore(
    (state) => state.state.allowanceDetails?.error,
  );
  const allowanceOk = usePaymentStore(
    (state) => state.state.allowanceDetails?.data,
  );
  const priceFeedError = usePaymentStore(
    (state) => state.state.priceFeedDetails?.error,
  );

  const dispatch = usePaymentStore((state) => state.dispatch);

  const token = useMainStore((state) => state.token);
  const routerAddress = useMainStore((state) => state.routerAddress);
  const curveLoading = useMainStore((state) => state.curveLoading);

  const resetPayment = useMainStore((state) => state.resetPayment);
  const pageCallback = useMainStore((state) => state.pageCallback);

  const { chain, address, isConnected } = useAccount();

  // Fetch the network's native token price in terms of USD
  const [nativeTokenPrice, , nativeTokenError] = useChainPriceFeed(chain);

  const tokenInfo = useMemo(
    () => token?.tokenInfo ?? ({} as TokenInfo),
    [token?.tokenInfo],
  );

  const allowanceNativeToken = useBalance({
    address,
    scopeKey: 'native',
  });

  const allowanceERC20 = useReadContract({
    address: tokenInfo.address as Address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address || '0x0', routerAddress || '0x0'],
    query: {
      enabled: isConnected && chain?.nativeCurrency.symbol !== tokenInfo.symbol,
    },
  });

  const { classes } = usePaymentStyles();

  const rawAmountIn = !token?.isAccepted
    ? bestSwap?.[0].amountIn
    : directPaymentAmountIn;

  const allowance =
    chain?.nativeCurrency.symbol !== tokenInfo.symbol
      ? allowanceERC20
      : allowanceNativeToken;

  const state = useLoadingState(
    allowance.isLoading || allowance.isFetching,
    !!allowanceOk,
    !!swapLoading,
    !!directPaymentLoading,
    !!token?.isAccepted,
    swapQuotes ?? null,
    curveLoading,
    nativeTokenPrice,
  );

  const isCalculatingPayment =
    state === LoadingState.SwapsLoading ||
    state === LoadingState.DirectPaymentLoading;

  const loadingLabel = useDynamicLoadingLabel({
    labels: [
      'Calculating payment',
      'Fetching the best rates',
      'Crunching the numbers',
      'Summing up the costs',
      'Working the math',
      'Tallying your total',
      'Estimating the expenses',
      'Finalizing the figures',
      'Sizing up the sum',
      'Compiling the calculations',
    ],
    shouldFallback: false,
    delay: 2000,
    shouldStop: !isCalculatingPayment,
  });

  useGetQuotes();
  useGetEstimates();
  useGetDirectPaymentAmount();
  useGetDirectPaymentGasDetails();

  useEffect(() => {
    if (allowance.error?.message) {
      dispatch({
        type: actions.SET_ALLOWANCE_ERROR,
        payload: 'Failed to fetch allowance',
      });
      return;
    }
    const allowanceData =
      chain?.nativeCurrency.symbol !== tokenInfo.symbol
        ? (allowance?.data as bigint)
        : (allowance?.data as GetBalanceReturnType)?.value;

    if (allowanceData !== undefined && rawAmountIn !== undefined) {
      const ok = isAllowanceSufficient(allowanceData, rawAmountIn);
      dispatch({
        type: actions.SET_ALLOWANCE_DETAILS,
        payload: { data: ok, loading: false, error: null },
      });
    }
  }, [
    allowance.data,
    allowance.error?.message,
    chain?.nativeCurrency.symbol,
    dispatch,
    rawAmountIn,
    tokenInfo?.symbol,
  ]);

  // clean up state on unmount
  useEffect(() => {
    return () => {
      dispatch({ type: actions.RESET_PAYMENT_STATE });
    };
  }, [dispatch]);

  useEffect(() => {
    pageCallback?.(
      RudderStackJSPageCategories.Payment,
      RudderStackJSPageNames.PaymentDialog,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!token || !chain) return null;

  if (
    swapError ||
    directPaymentError ||
    allowanceError ||
    priceFeedError ||
    nativeTokenError
  ) {
    return (
      <ErrorIndicator
        error={
          swapError ??
          directPaymentError ??
          allowanceError ??
          priceFeedError ??
          nativeTokenError
        }
        withRetry
        handleRetry={resetPayment}
      />
    );
  }

  const loadingIndicator = (
    <LoadingIndicator
      label={isCalculatingPayment ? loadingLabel : 'Loading allowance'}
    />
  );

  const warningIndicator = (
    <WarningIndicator label={`No swaps available for ${tokenInfo.symbol}`} />
  );

  const renderedIndicator = {
    [LoadingState.AllowanceLoading]: loadingIndicator,
    [LoadingState.DirectPaymentLoading]: loadingIndicator,
    [LoadingState.SwapsLoading]: loadingIndicator,
    [LoadingState.NoSwaps]: warningIndicator,
  }[state];

  const renderedContent = (
    <>
      <Flex grow={1} direction="column">
        <Flex
          className={clsx(classes.flex, classes.fullGrow)}
          direction="column"
        >
          <Flex
            className={clsx(classes.flex, classes.noGrow)}
            direction="column"
          >
            <PaymentHeader />
            <PaymentAmounts />
            <PaymentAutoswap />
            <PaymentFooter />
          </Flex>
        </Flex>
        <Flex
          className={clsx(classes.flex, classes.noGrow)}
          direction="column"
          mt={24}
        >
          <Flex
            className={clsx(classes.flex, classes.noGrow)}
            justify="space-between"
          >
            {state === LoadingState.Allowing && (
              <ApproveButton allowance={allowance} />
            )}
            {state === LoadingState.Confirming && (
              <PaymentButton rawAmountIn={rawAmountIn} />
            )}
          </Flex>
        </Flex>
      </Flex>
    </>
  );

  return customChildren ? (
    children({
      state,
      rawAmountIn,
      allowance,
      isCalculatingPayment,
      loadingLabel,
      nativeTokenPrice,
      tokenInfo,
      allowanceNativeToken,
      renderedIndicator,
      pageCallback,
    })
  ) : (
    <Flex direction="column" grow={1}>
      {renderedIndicator ?? renderedContent}
    </Flex>
  );
}

export default function PaymentDialogWrapper(props: PaymentDialogProps) {
  const paymentStateKey = usePaymentStore(
    (state) => state.state.paymentStateKey,
  );

  return (
    <React.Fragment key={paymentStateKey}>
      <PaymentDialog {...props} />
    </React.Fragment>
  );
}
