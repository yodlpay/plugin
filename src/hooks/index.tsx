import {
  AddressZero,
  CHAINS,
  CoinConfig,
  Currency,
  DESIRED_NUMBER_OF_CONFIRMATIONS,
  EstimationResult,
  GasDetails,
  IChainDataAPI,
  Invoice,
  LoadingState,
  NATIVE_TOKEN_ADDRESS,
  NON_STABLECOIN_SLIPPAGE,
  OnCompleteActionType,
  PaymentPayload,
  PaymentType,
  PriceFeedDetails,
  Quote,
  RETURN_REMAINDER_DEFAULT,
  RemainderDetails,
  STABLECOIN_SLIPPAGE,
  SimulateTransactionArgs,
  SwapVenue,
  TokenData,
  TokenHeld,
  coinIdToToken,
  fetchToken,
  getPriceFromFeed,
  sleep,
} from "@hiropay/common";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { TokenInfo, TokenListTagNames, getChain } from "@yodlpay/tokenlists";
import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Address, Chain, erc20Abi } from "viem";
import {
  useAccount,
  useBalance,
  useBlockNumber,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useReadContracts,
} from "wagmi";
import { WELCOME_DISPLAYED } from "../constants/test";
import { useInvoiceStore } from "../contexts/useInvoiceStore";
import { useMainStore } from "../contexts/useMainStore";
import { usePaymentStore } from "../contexts/usePaymentStore";
import { useTokenStore } from "../contexts/useTokenStore";
import ChainDialog from "../dialogs/ChainDialog";
import PaymentDialog from "../dialogs/PaymentDialog";
import StatusDialog from "../dialogs/StatusDialog";
import TokenDialog from "../dialogs/TokenDialog";
import WalletDialog from "../dialogs/WalletDialog";
import WelcomeDialog from "../dialogs/WelcomeDialog";
import { actions } from "../reducers/payment";
import {
  createPayload,
  createPayloadV1,
  determineCheapestSwapWithGas,
  determineCheapestSwapWithoutGas,
  determineMostExpensiveSwap,
  fetchAllQuotes,
  fetchEstimates,
  formatWagmiError,
  getChainNativeCurrency,
  getTokenOutInfo,
  isBalanceSufficient,
  normalizeBigInt,
  parseAmountInMinorForComparison,
  parseExchangeRates,
  simulateTransaction,
} from "../utils/helpers";
import {
  getExchangeRate,
  getPriceFeeds,
  getRouterAbi,
} from "../utils/priceFeedHelpers";

export const usePayment = () => {
  const invoice = useInvoiceStore((state) => state.invoice);
  return { invoice };
};

export const usePriceFeed = (feedAddress: Address | undefined) => {
  const logger = useMainStore((state) => state.logger);

  const client = usePublicClient();
  const [price, setPrice] = useState<bigint | undefined>(undefined);
  const [decimals, setDecimals] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const fetchFeedPrices = useCallback(async () => {
    try {
      if (!feedAddress) return;

      setError("");
      setLoading(true);

      const [feedPrice, feedDecimals] = await getPriceFromFeed(
        client,
        feedAddress
      );
      setPrice(feedPrice);
      setDecimals(feedDecimals);
    } catch (err) {
      logger?.error(`Failed to get price feed with error: ${err}`);
      setPrice(undefined);
      setDecimals(undefined);
      setError("Failed to fetch price feed");
    } finally {
      setLoading(false);
    }
  }, [client, feedAddress, logger]);

  useEffect(() => {
    // fetch the rate if the price feed is present
    if (!feedAddress) {
      setPrice(undefined);
      setDecimals(undefined);
      return;
    }

    fetchFeedPrices();
  }, [feedAddress, fetchFeedPrices]);

  return [price, decimals, error, loading] as [
    bigint | undefined,
    number | undefined,
    string,
    boolean
  ];
};

export const useChainPriceFeed = (chain: Chain | undefined) => {
  const logger = useMainStore((state) => state.logger);

  const [feedAddress, setFeedAddress] = useState<Address | undefined>(
    undefined
  );
  const [feedAddressError, setFeedAddressError] = useState<string | undefined>(
    undefined
  );
  const [price, decimals, priceFeedError, loading] = usePriceFeed(feedAddress);

  useEffect(() => {
    if (!chain?.id) {
      logger?.info(`No chain was provided`);
      setFeedAddressError(`Failed to get price feed details`);
      setFeedAddress(undefined);
      return;
    }

    // extract the native currency from the chain
    const nativeCurrencySymbol = getChainNativeCurrency(chain);

    // see if we have the native currency present as a price feed in the token list
    const chainDetails = getChain(chain.id);
    if (!chainDetails) {
      logger?.info(`Chain ${chain.id} was not present in the chain list`);
      setFeedAddressError(`Failed to get price feed details`);
      setFeedAddress(undefined);
      return;
    }
    const chainPriceFeeds = chainDetails.priceFeeds;
    if (!chainPriceFeeds) {
      logger?.info(`${chain.name} does not have a price feeds dictionary`);
      setFeedAddressError(`Failed to get price feed details`);
      setFeedAddress(undefined);
      return;
    }
    const feedAddress = chainPriceFeeds[nativeCurrencySymbol] as Address;

    if (!feedAddress) {
      logger?.info(
        `${chain.name} does not have a feed address for ${nativeCurrencySymbol}`
      );
      setFeedAddressError(
        `${chain.name} does not have a feed address for ${nativeCurrencySymbol}`
      );
      setFeedAddress(undefined);
      return;
    }

    setFeedAddress(feedAddress);
  }, [chain, chain?.id, chain?.nativeCurrency.symbol, logger]);

  return [price, decimals, priceFeedError || feedAddressError, loading] as [
    bigint | undefined,
    number | undefined,
    string,
    boolean
  ];
};

export const useFeeBps = (chain: Chain | undefined, routerAddress: Address) => {
  const logger = useMainStore((state) => state.logger);
  const routerVersion = useMainStore((state) => state.routerVersion);

  const client = usePublicClient();
  const routerAbi = getRouterAbi(routerVersion);
  const [feeBps, setFeeBps] = useState<bigint | undefined>(undefined);

  const fetchFeeBps = useCallback(async () => {
    try {
      const baseFeeBps = (await client?.readContract({
        address: routerAddress,
        abi: routerAbi,
        functionName: "baseFeeBps",
        args: [],
      })) as unknown as bigint;
      setFeeBps(baseFeeBps);
    } catch (err) {
      setFeeBps(undefined);
      logger?.error(`Failed to fetch baseFeeDivisor with error ${err}`);
      enqueueSnackbar("Failed to fetch fee divisor", {
        variant: "error",
      });
    }
  }, [logger, client, routerAbi, routerAddress]);

  useEffect(() => {
    if (!chain?.id) {
      logger?.info(`No chain was provided`);
      setFeeBps(undefined);
      return;
    }

    fetchFeeBps();
  }, [logger, chain?.id, routerAddress, client, fetchFeeBps]);

  return feeBps;
};

// This function determines the tokenOut based on the recipient's preferences, if this payment
// requires a swap, and if is a swap, fetches the necessary parameters from the Uniswap routing API
export const useFetchPayload = (
  tokenIn: TokenInfo,
  invoice: Invoice,
  swapQuote: Quote | undefined,
  swapVenue: SwapVenue | undefined,
  returnRemainder: boolean,
  priceFeedDetails: PriceFeedDetails | null,
  rawAmountIn: bigint | undefined
): [boolean, boolean, PaymentPayload, Error | undefined] => {
  const [[isLoading, isError, payload, error], setState] = useState<
    [boolean, boolean, PaymentPayload, undefined | Error]
  >([true, false, {} as PaymentPayload, undefined]);
  const { address: sender, chain } = useAccount();
  const tokenAddress = useMemo(
    () =>
      tokenIn.symbol != chain?.nativeCurrency.symbol
        ? (tokenIn.address as Address)
        : undefined,
    [tokenIn, chain]
  );
  const { data: balanceData } = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [sender ?? "0x"],
      },
      {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "decimals",
      },
      {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "symbol",
      },
    ],
  });

  const routerVersion = useMainStore((state) => state.routerVersion);

  // Check that we have a sufficient balance for the payment
  const [sufficientBalance, errorMsg] = useMemo(() => {
    if (!!balanceData && !!balanceData[0] && rawAmountIn !== undefined) {
      const balance = balanceData[0];
      if (!!swapQuote && balance < swapQuote.amountIn!) {
        enqueueSnackbar("Insufficient balance for swap", { variant: "error" });
        return [false, Error("Insufficient balance for swap")];
      }

      if (!swapQuote && balance < rawAmountIn) {
        enqueueSnackbar("Insufficient balance for payment", {
          variant: "error",
        });
        return [false, Error("Insufficient balance for payment")];
      }
    }
    return [true, undefined];
  }, [balanceData, swapQuote, rawAmountIn]);

  // TODO check dependency array
  const fetchPayload = useCallback(async () => {
    try {
      let payload;
      if (routerVersion === "0.1") {
        payload = createPayloadV1(
          sender as Address,
          tokenIn,
          invoice,
          chain as Chain,
          swapQuote,
          swapVenue,
          priceFeedDetails
        );
      } else {
        payload = createPayload(
          sender as Address,
          tokenIn,
          invoice,
          chain as Chain,
          swapQuote,
          swapVenue,
          RETURN_REMAINDER_DEFAULT ?? returnRemainder,
          priceFeedDetails
        );
      }
      setState([false, false, payload, undefined]);
    } catch (err) {
      // error handled in the parent component
      setState([false, true, {} as PaymentPayload, err as Error]);
    }
  }, [
    routerVersion,
    sender,
    tokenIn,
    invoice,
    chain,
    swapQuote,
    swapVenue,
    returnRemainder,
    priceFeedDetails,
  ]);

  useEffect(() => {
    if (
      priceFeedDetails &&
      priceFeedDetails.approximateRate === 0n &&
      priceFeedDetails.convertedAmount === 0n
    ) {
      // we are still fetching the rates, do not create the payload yet
      return;
    }
    // Check that we have sufficient balances before creating the payload
    if (!sufficientBalance) {
      setState([false, true, {} as PaymentPayload, errorMsg]);

      return;
    }
    fetchPayload();
  }, [fetchPayload, priceFeedDetails, sufficientBalance, errorMsg]);

  return [isLoading, isError, payload, error];
};

export const useLoadingState = (
  isLoadingAllowance: boolean,
  isOk: boolean,
  swapLoading: boolean,
  directPaymentLoading: boolean,
  isAccepted: boolean,
  swapQuotes: [Quote, SwapVenue][] | null,
  curveIsLoading: boolean,
  nativeTokenPrice: bigint | undefined
) => {
  const [state, setState] = useState(LoadingState.AllowanceLoading);

  useEffect(() => {
    if (isLoadingAllowance) {
      setState(LoadingState.AllowanceLoading);
    } else if (
      directPaymentLoading ||
      (isAccepted && (!nativeTokenPrice || curveIsLoading))
    ) {
      setState(LoadingState.DirectPaymentLoading);
    } else if (
      swapLoading ||
      (!isAccepted &&
        (!nativeTokenPrice ||
          swapQuotes?.length === undefined ||
          curveIsLoading))
    ) {
      setState(LoadingState.SwapsLoading);
    } else if (swapQuotes?.length === 0) {
      setState(LoadingState.NoSwaps);
    } else if (isOk) {
      setState(LoadingState.Confirming);
    } else {
      setState(LoadingState.Allowing);
    }
  }, [
    isLoadingAllowance,
    isOk,
    swapLoading,
    isAccepted,
    swapQuotes?.length,
    curveIsLoading,
    directPaymentLoading,
    nativeTokenPrice,
  ]);

  return state;
};

export const useViewBasedState = (
  view: JSX.Element | null,
  resetChain = () => {},
  resetToken = () => {}
) => {
  const setSkippedWelcome = useMainStore((state) => state.setSkippedWelcome);
  const exchangeRates = useTokenStore((state) => state.exchangeRates);
  const tokensHeld = useTokenStore((state) => state.tokensHeld);

  const { disconnect } = useDisconnect();

  const wasSkippedInitially = useRef(!!localStorage.getItem(WELCOME_DISPLAYED));
  const wasLoadedInitially = useRef(false);

  // prevent duplicated calls to the API
  const areTokensLoading =
    exchangeRates === null ||
    exchangeRates?.loading === true ||
    tokensHeld === null ||
    tokensHeld?.loading === true;

  if (!areTokensLoading) {
    wasLoadedInitially.current = true;
  }

  const { acceptedTokens } = useAvailableTokens();

  const handleUnskipWelcome = () => {
    localStorage.removeItem(WELCOME_DISPLAYED);
    setSkippedWelcome(false);
  };

  const defaultComponent = {
    key: "WalletDialog",
    heading: "Connect Wallet",
    subheading: "Connect your wallet",
    onBackButtonClick: wasSkippedInitially.current
      ? null
      : () => handleUnskipWelcome(),
  };
  if (view?.type === WelcomeDialog) {
    return {
      key: "WelcomeDialog",
      heading: "",
      subheading: "",
      onBackButtonClick: null,
    };
  }
  if (view?.type === WalletDialog) {
    return defaultComponent;
  }
  if (view?.type === ChainDialog) {
    return {
      key: "ChainDialog",
      heading: "Choose Network",
      subheading: "Choose your preferred network",
      onBackButtonClick: () => {
        disconnect();
      },
    };
  }
  if (view?.type === TokenDialog) {
    return {
      key: "TokenDialog",
      heading: "Choose Token",
      subheading:
        !areTokensLoading &&
        wasLoadedInitially?.current &&
        (acceptedTokens?.length ?? 0) > 0
          ? "Recipient preferred tokens:"
          : "",
      onBackButtonClick: () => {
        resetChain();
      },
    };
  }
  if (view?.type === PaymentDialog) {
    return {
      key: "PaymentDialog",
      heading: "Confirm Payment",
      subheading: "",
      onBackButtonClick: () => resetToken(),
    };
  }
  if (view?.type === StatusDialog) {
    return {
      key: "StatusDialog",
      heading: "",
      subheading: "",
      onBackButtonClick: null,
    };
  }

  return defaultComponent;
};

export const useAvailableChains = () => {
  const { invoice } = usePayment();

  const chainsWithBalance = useMainStore((state) => state.chainsWithBalance);

  const chainIds = invoice.coins.map(
    (coinConfig: CoinConfig) => coinConfig.chainId
  );

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
              ).length
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

  return { availableChains };
};

export const useBlockConfirmations = () => {
  const transaction = useMainStore((state) => state.transaction);
  const testnetMode = useMainStore((state) => state.testnetMode);
  const currentBlockNumber = useBlockNumber({ watch: true });
  const { confirmations: demoConfirmations } = useDemoBlockConfirmations();

  if (testnetMode) {
    return { confirmations: demoConfirmations };
  }

  const receiptBlockNumber = transaction?.data?.receipt?.blockNumber;

  const confirmations = Number(
    receiptBlockNumber && currentBlockNumber?.data
      ? currentBlockNumber?.data - receiptBlockNumber
      : 0n
  );

  return { confirmations };
};

// Demo confirmations (for localhost)

export const useDemoBlockConfirmations = () => {
  const [confirmations, setConfirmations] = useState(0);

  useEffect(() => {
    const incrementConfirmations = () => {
      setConfirmations((prev) => {
        if (prev < DESIRED_NUMBER_OF_CONFIRMATIONS) {
          return prev + 1;
        }
        return prev;
      });
    };

    const intervalId = setInterval(
      incrementConfirmations,
      Math.random() * (2500 - 700) + 700
    );

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return { confirmations };
};

export const useGetQuotes = () => {
  const dispatch = usePaymentStore((state) => state.dispatch);

  const logger = useMainStore((state) => state.logger);
  const token = useMainStore((state) => state.token);
  const routerVersion = useMainStore((state) => state.routerVersion);
  const routerAddress = useMainStore((state) => state.routerAddress);
  const chainDataAPI = useMainStore((state) => state.chainDataAPI);
  const curveLoading = useMainStore((state) => state.curveLoading);

  const { invoice } = usePayment();
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();

  const tokenInfo = useMemo(
    () => token?.tokenInfo ?? ({} as TokenInfo),
    [token?.tokenInfo]
  );

  const allowanceNativeToken = useBalance({
    address,
    scopeKey: "native",
  });

  const allowanceERC20 = useReadContract({
    address: tokenInfo.address as Address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address || "0x0", routerAddress || "0x0"],
    query: {
      enabled: isConnected && chain?.nativeCurrency.symbol !== tokenInfo.symbol,
    },
  });

  const quotesRequests = useRef({ exchangeRate: 0, quotes: 0 });

  const allowance = useRef(
    chain?.nativeCurrency.symbol !== tokenInfo.symbol
      ? allowanceERC20
      : allowanceNativeToken
  );

  useEffect(() => {
    // use swap prices
    // for now we'll try with the first accepted coin from the invoice
    // if isAccepted is true, we do not need to swap
    if (
      !invoice?.amountInMinor ||
      !token?.balance ||
      !chain?.id ||
      !address ||
      token?.isAccepted ||
      curveLoading
    ) {
      return;
    }

    const getQuotes = async () => {
      if (!chain?.id || !routerAddress || routerVersion === "0.1") return;

      dispatch({
        type: actions.SET_SWAP_LOADING,
        payload: true,
      });

      const tokenOutInfo = getTokenOutInfo(invoice, chain);

      // Stablecoin pools generally have better swaps, so we can provide less slippage.
      // There may be a non-stable token in a multi-path swap, however it would complicate things to account for that.
      const isStableSwap =
        !!tokenInfo.tags?.includes(TokenListTagNames.STABLECOIN) &&
        !!tokenOutInfo.tags?.includes(TokenListTagNames.STABLECOIN);
      const slippage = isStableSwap
        ? STABLECOIN_SLIPPAGE
        : NON_STABLECOIN_SLIPPAGE;
      dispatch({
        type: actions.SET_SLIPPAGE,
        payload: slippage,
      });
      let amount = parseAmountInMinorForComparison(
        invoice.amountInMinor.toString(),
        tokenOutInfo.decimals
      );
      // Ensure the latest API call gets saved
      const currentExchangeRateRequest = ++quotesRequests.current.exchangeRate;
      const currentQuotesRequest = ++quotesRequests.current.quotes;
      if (tokenOutInfo.currency != invoice.currency) {
        // Convert invoice amount into tokenOut using price feeds
        const chainInfo = getChain(chain.id);
        try {
          const feedAddresses = getPriceFeeds(
            chainInfo,
            invoice.currency as Currency,
            tokenOutInfo,
            PaymentType.SWAP
          );
          if (feedAddresses.length == 0) {
            dispatch({
              type: actions.SET_PRICE_FEED_DETAILS,
              payload: {
                data: {
                  feedAddresses: [AddressZero, AddressZero],
                  approximateRate: 10n ** 8n,
                  convertedAmount: amount,
                  decimals: token.tokenInfo.decimals,
                } as PriceFeedDetails,
                loading: false,
                error: null,
              },
            });
          } else {
            // We need to reverse the feeds because for a swap we are working backwards
            // to figure out the token amount out from the invoice currency
            const [converted] = await getExchangeRate(
              publicClient,
              routerAddress,
              routerVersion,
              feedAddresses.reverse(),
              amount
            );
            if (
              currentExchangeRateRequest === quotesRequests.current.exchangeRate
            ) {
              dispatch({
                type: actions.SET_PRICE_FEED_DETAILS,
                payload: {
                  data: {
                    feedAddresses,
                    approximateRate: (converted * 10n ** 8n) / amount,
                    convertedAmount: converted,
                    decimals: token.tokenInfo.decimals,
                  },
                  loading: false,
                  error: null,
                },
              });
              // Set amount to converted amount
              amount = converted;
            }
          }
        } catch (err) {
          const errorMessage = (err as Error).message;
          logger?.info(
            `Could not get price feed details for ${invoice.currency}->${tokenOutInfo.currency}`
          );
          dispatch({ type: actions.RESET_SWAP_STATE });
          dispatch({
            type: actions.SET_PRICE_FEED_DETAILS,
            payload: {
              data: null,
              loading: false,
              error:
                errorMessage ??
                `Could not get price feed details for ${invoice.currency}->${tokenOutInfo.currency}`,
            },
          });
          return;
        }
      }

      try {
        const quotes = await fetchAllQuotes(
          amount,
          tokenInfo,
          tokenOutInfo,
          publicClient,
          slippage,
          chainDataAPI,
          invoice.excludedVenues
        );
        if (currentQuotesRequest === quotesRequests.current.quotes) {
          // Get the most expensive swap and display that to the user
          const mostExpensiveSwap = determineMostExpensiveSwap(quotes);
          // Set the quotes
          dispatch({
            type: actions.SET_SWAP_DETAILS,
            payload: {
              swapQuotes: quotes,
              bestSwap: mostExpensiveSwap,
              loading: true,
              error: null,
            },
          });

          allowance.current.refetch();

          // hacky way to allow enough time for allowance to change loading state

          dispatch({
            type: actions.SET_SWAP_DETAILS,
            payload: {
              swapQuotes: quotes,
              bestSwap: mostExpensiveSwap,
              loading: false,
              error: null,
            },
          });
        }
      } catch (error) {
        logger?.error("failed to fetch swap quote");
        logger?.error(error);
        dispatch({
          type: actions.SET_SWAP_ERROR,
          payload: "Failed to determine the payment amount",
        });
      }
    };

    getQuotes();
  }, [
    address,
    chain,
    chain?.id,
    chainDataAPI,
    curveLoading,
    dispatch,
    invoice,
    invoice.amountInMinor,
    logger,
    publicClient,
    routerAddress,
    routerVersion,
    token?.balance,
    token?.isAccepted,
    token?.tokenInfo.decimals,
    tokenInfo,
  ]);
};

export const useGetEstimates = () => {
  const swapQuotes = usePaymentStore(
    (state) => state.state.swapDetails?.swapQuotes
  );
  const allowanceOk = usePaymentStore(
    (state) => state.state.allowanceDetails?.data
  );
  const priceFeedDetails = usePaymentStore(
    (state) => state.state.priceFeedDetails
  );

  const dispatch = usePaymentStore((state) => state.dispatch);

  const logger = useMainStore((state) => state.logger);
  const token = useMainStore((state) => state.token);
  const routerVersion = useMainStore((state) => state.routerVersion);

  const { invoice } = usePayment();
  const { address, chain } = useAccount();
  const publicClient = usePublicClient();

  // Fetch the network's native token price in terms of USD
  const [nativeTokenPrice, nativeTokenPriceDecimals] = useChainPriceFeed(chain);

  const tokenInfo = useMemo(
    () => token?.tokenInfo ?? ({} as TokenInfo),
    [token?.tokenInfo]
  );

  const estimatesRequest = useRef(0);

  useEffect(() => {
    if (
      !chain?.id ||
      !allowanceOk ||
      !swapQuotes?.length ||
      swapQuotes.length === 0 ||
      !nativeTokenPrice ||
      !nativeTokenPriceDecimals
    ) {
      return;
    }

    const getEstimates = async () => {
      try {
        if (
          !chain?.id ||
          !nativeTokenPrice ||
          !nativeTokenPriceDecimals ||
          !swapQuotes?.length
        )
          return;

        // ensure the latest API call gets saved
        const currentRequest = ++estimatesRequest.current;

        dispatch({
          type: actions.SET_GAS_LOADING,
          payload: true,
        });

        const tokenOutInfo = getTokenOutInfo(invoice, chain);

        const estimates = await fetchEstimates(
          swapQuotes,
          address as Address,
          chain,
          invoice,
          tokenInfo,
          tokenOutInfo,
          publicClient,
          routerVersion,
          nativeTokenPrice,
          nativeTokenPriceDecimals,
          priceFeedDetails?.data ?? null
        );

        if (currentRequest === estimatesRequest.current) {
          let cheapestSwap;
          if (estimates.length == 0) {
            logger?.info("Failed to get gas estimates...");
            // use the cheapest swap ignoring gas
            cheapestSwap = determineCheapestSwapWithoutGas(swapQuotes);
            dispatch({ type: actions.RESET_GAS_STATE });
          } else {
            // We have gas estimates present
            const cheapestSwapWithGas = determineCheapestSwapWithGas(estimates);
            cheapestSwap = [
              cheapestSwapWithGas.quote,
              cheapestSwapWithGas.venue,
            ] as [Quote, SwapVenue];
            dispatch({
              type: actions.SET_GAS_STATE,
              payload: {
                gasDetails: {
                  data: {
                    gas: cheapestSwapWithGas.gas,
                    gasInInvoiceCurrency:
                      cheapestSwapWithGas.gasInInvoiceCurrency,
                    gasInUsd: cheapestSwapWithGas.gasInUsd,
                    gasPrice: cheapestSwapWithGas.gasPrice,
                    tokenOut: cheapestSwapWithGas.tokenOut,
                  } as GasDetails,
                  loading: false,
                  error: null,
                },
                remainderDetails: {
                  remainderInInvoiceCurrency:
                    cheapestSwapWithGas.remainderInInvoiceCurrency,
                  returnRemainderCost: cheapestSwapWithGas.returnRemainderCost,
                  returnRemainderDelta:
                    cheapestSwapWithGas.returnRemainderDelta,
                  shouldReturnRemainder:
                    cheapestSwapWithGas.shouldReturnRemainder,
                } as RemainderDetails,
              },
            });
          }
          dispatch({
            type: actions.SET_SWAP_DETAILS,
            payload: {
              bestSwap: cheapestSwap,
              swapQuotes,
              loading: false,
              error: null,
            },
          });
        }
      } catch (err) {
        logger?.error("Failed to get gas estimates");
        logger?.error(err);
        dispatch({
          type: actions.SET_GAS_ERROR,
          payload: "Failed to determine gas fees",
        });
      }
    };

    // Fetch gas estimates and pass through the cheaper swap to the PaymentButtonWrapper
    // tokenOut must currently be USD only as the SC doesn't support inverse price feeds
    getEstimates();
  }, [
    allowanceOk,
    chain?.id,
    nativeTokenPrice,
    nativeTokenPriceDecimals,
    swapQuotes?.length,
    priceFeedDetails?.data?.approximateRate,
    chain,
    swapQuotes,
    dispatch,
    invoice,
    address,
    tokenInfo,
    publicClient,
    routerVersion,
    priceFeedDetails?.data,
    logger,
  ]);
};

export const useGetDirectPaymentAmount = () => {
  const dispatch = usePaymentStore((state) => state.dispatch);

  const logger = useMainStore((state) => state.logger);
  const token = useMainStore((state) => state.token);
  const routerVersion = useMainStore((state) => state.routerVersion);
  const routerAddress = useMainStore((state) => state.routerAddress);

  const { invoice } = usePayment();
  const { chain } = useAccount();
  const publicClient = usePublicClient();

  const chainInfo = getChain(chain?.id ?? -1);

  const tokenInfo = useMemo(
    () => token?.tokenInfo ?? ({} as TokenInfo),
    [token?.tokenInfo]
  );

  const directPaymentRequest = useRef(0);

  useEffect(() => {
    if (
      !chainInfo?.priceFeeds ||
      !token?.balance ||
      !token?.isAccepted ||
      !routerAddress
    ) {
      return;
    }

    const getDirectPaymentAmount = async () => {
      try {
        dispatch({
          type: actions.SET_DIRECT_PAYMENT_LOADING,
          payload: true,
        });

        // ensure the latest API call gets saved
        const currentRequest = ++directPaymentRequest.current;

        const feedAddresses = getPriceFeeds(
          chainInfo,
          invoice.currency as Currency,
          tokenInfo,
          PaymentType.DIRECT
        );

        let priceFeedDetails = null;
        // Payment amount with tokenInfo decimals, or 18 decimals (for ETH)
        let directPaymentAmount =
          invoice.currency === Currency.ETH
            ? // Account for already having multiplied the value by 100
              BigInt(invoice.amountInMinor) * 10n ** 16n
            : BigInt(invoice.amountInMinor) *
              10n ** BigInt(tokenInfo.decimals - 2);
        const approximateRateDecimals =
          invoice.currency === Currency.ETH ? 18 : tokenInfo.decimals;
        if (feedAddresses.length == 0) {
          // Hacky way of getting the payload method to error out for the V0.1 router
          priceFeedDetails = {
            feedAddresses: [AddressZero, AddressZero],
            approximateRate: 10n ** 8n,
            convertedAmount: directPaymentAmount,
            decimals: approximateRateDecimals,
          } as PriceFeedDetails;
        } else {
          const amountIn = directPaymentAmount;
          const [converted] = await getExchangeRate(
            publicClient,
            routerAddress,
            routerVersion,
            feedAddresses,
            amountIn
          );
          directPaymentAmount =
            invoice.currency === Currency.ETH
              ? converted / 10n ** (18n - BigInt(tokenInfo.decimals))
              : converted;

          priceFeedDetails = {
            feedAddresses,
            approximateRate: (converted * 10n ** 8n) / amountIn,
            convertedAmount: converted,
            decimals: approximateRateDecimals,
          } as PriceFeedDetails;
        }

        if (currentRequest === directPaymentRequest.current) {
          dispatch({
            type: actions.SET_PRICE_FEED_DETAILS,
            payload: {
              data: priceFeedDetails,
              loading: false,
              error: null,
            },
          });
          dispatch({
            type: actions.SET_DIRECT_PAYMENT_DETAILS,
            payload: {
              data: directPaymentAmount,
              loading: false,
              error: null,
            },
          });
        }
      } catch (err) {
        const errorMessage = (err as Error).message.includes("Price feed")
          ? (err as Error).message
          : "Failed to determine the payment amount";
        logger?.error(`Failed to determine the payment amount: ${err}`);
        dispatch({
          type: actions.SET_DIRECT_PAYMENT_ERROR,
          payload: errorMessage,
        });
      }
    };

    getDirectPaymentAmount();
  }, [
    chainInfo?.priceFeeds,
    token?.balance,
    token?.isAccepted,
    routerAddress,
    chainInfo,
    dispatch,
    invoice.currency,
    invoice.amountInMinor,
    tokenInfo,
    publicClient,
    routerVersion,
    logger,
  ]);
};

export const useGetDirectPaymentGasDetails = () => {
  const allowanceOk = usePaymentStore(
    (state) => state.state.allowanceDetails?.data
  );
  const priceFeedDetails = usePaymentStore(
    (state) => state.state.priceFeedDetails
  );

  const dispatch = usePaymentStore((state) => state.dispatch);

  const logger = useMainStore((state) => state.logger);
  const token = useMainStore((state) => state.token);
  const routerVersion = useMainStore((state) => state.routerVersion);
  const routerAddress = useMainStore((state) => state.routerAddress);

  const { invoice } = usePayment();
  const { address, chain } = useAccount();
  const publicClient = usePublicClient();

  // Fetch the network's native token price in terms of USD
  const [nativeTokenPrice, nativeTokenPriceDecimals] = useChainPriceFeed(chain);

  const tokenInfo = useMemo(
    () => token?.tokenInfo ?? ({} as TokenInfo),
    [token?.tokenInfo]
  );

  const directGasRequest = useRef(0);

  useEffect(() => {
    if (
      !token?.balance ||
      !token?.isAccepted ||
      !routerAddress ||
      !nativeTokenPrice ||
      !nativeTokenPriceDecimals ||
      !priceFeedDetails?.data?.approximateRate ||
      // this will error out if the allowance is not set
      !allowanceOk
    ) {
      return;
    }

    const getDirectPaymentGasDetails = async () => {
      try {
        dispatch({
          type: actions.SET_GAS_LOADING,
          payload: true,
        });

        // ensure the latest API call gets saved
        const currentRequest = ++directGasRequest.current;

        const estimates = await fetchEstimates(
          [[{} as Quote, SwapVenue.NONE]],
          address as Address,
          chain as Chain,
          invoice,
          tokenInfo,
          tokenInfo,
          publicClient,
          routerVersion,
          nativeTokenPrice as bigint,
          nativeTokenPriceDecimals as number,
          priceFeedDetails?.data ?? null
        );

        if (currentRequest === directGasRequest.current) {
          if (!estimates.length) throw Error("Failed to fetch gas estimates");

          dispatch({
            type: actions.SET_GAS_STATE,
            payload: {
              gasDetails: {
                data: {
                  gas: estimates[0].gas,
                  gasInInvoiceCurrency: estimates[0].gasInInvoiceCurrency,
                  gasInUsd: estimates[0].gasInUsd,
                  gasPrice: estimates[0].gasPrice,
                  tokenOut: estimates[0].tokenOut,
                } as GasDetails,
                loading: false,
                error: null,
              },
              remainderDetails: {
                remainderInInvoiceCurrency: 0n,
                returnRemainderCost: estimates[0].returnRemainderCost,
                returnRemainderDelta: estimates[0].returnRemainderDelta,
                shouldReturnRemainder: estimates[0].shouldReturnRemainder,
              } as RemainderDetails,
            },
          });
        }
      } catch (err) {
        logger?.error(err);
        dispatch({
          type: actions.SET_GAS_ERROR,
          payload: "Failed to determine gas fees",
        });
      }
    };

    getDirectPaymentGasDetails();
  }, [
    token?.balance,
    token?.isAccepted,
    routerAddress,
    nativeTokenPrice,
    nativeTokenPriceDecimals,
    priceFeedDetails?.data?.approximateRate,
    allowanceOk,
    priceFeedDetails?.data,
    dispatch,
    address,
    chain,
    invoice,
    tokenInfo,
    publicClient,
    routerVersion,
    logger,
  ]);
};

export const useIsBalanceSufficientToCoverGas = () => {
  const [isSufficient, setIsSufficient] = useState(true);
  const gasLoading = usePaymentStore(
    (state) => state.state.gasDetails?.loading
  );
  const gasError = usePaymentStore((state) => state.state.gasDetails?.error);
  const gasDetails = usePaymentStore(({ state }) => state.gasDetails?.data);

  const token = useMainStore((state) => state.token);

  const { address, chain } = useAccount();

  const { normalizedRawAmountIn } = useRawAmountIn();

  const isNativeToken =
    chain?.nativeCurrency.symbol === token?.tokenInfo.symbol;

  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    isFetching: isFetchingBalance,
    isError: isErrorBalance,
  } = useBalance({
    address,
  });

  useEffect(() => {
    if (
      !gasLoading &&
      !isLoadingBalance &&
      !isFetchingBalance &&
      balanceData?.value &&
      balanceData?.decimals &&
      gasDetails?.gas &&
      gasDetails?.gasPrice
    ) {
      const result =
        normalizeBigInt(balanceData?.value, balanceData?.decimals) -
        (normalizeBigInt(
          gasDetails?.gas * gasDetails?.gasPrice,
          chain?.nativeCurrency.decimals ?? 1
        ) +
          (isNativeToken ? normalizedRawAmountIn : 0));
      setIsSufficient(!!result);
    }
  }, [
    balanceData?.decimals,
    balanceData?.value,
    chain?.nativeCurrency.decimals,
    gasDetails?.gas,
    gasDetails?.gasPrice,
    gasLoading,
    isFetchingBalance,
    isLoadingBalance,
    isNativeToken,
    normalizedRawAmountIn,
  ]);

  return {
    isSufficient,
    isLoading: gasLoading || isLoadingBalance || isFetchingBalance,
    error: gasError ?? isErrorBalance,
  };
};

export const useRawAmountIn = () => {
  const directPaymentAmountIn = usePaymentStore(
    (state) => state.state.directPaymentDetails?.data
  );
  const bestSwap = usePaymentStore(
    (state) => state.state.swapDetails?.bestSwap
  );

  const token = useMainStore((state) => state.token);

  const rawAmountIn = useMemo(
    () => (!token?.isAccepted ? bestSwap?.[0].amountIn : directPaymentAmountIn),
    [bestSwap, directPaymentAmountIn, token?.isAccepted]
  );

  const normalizedRawAmountIn = normalizeBigInt(
    rawAmountIn ?? 0n,
    token?.tokenInfo.decimals ?? 1
  );

  return { rawAmountIn, normalizedRawAmountIn };
};

export const useSimulateTransaction = ({
  contractArgs,
  provider,
  chain,
  nativeTokenPrice,
  nativeTokenPriceDecimals,
  tokenOut,
  routerAddress,
  quote,
  venue,
  invoice,
  priceFeedDetails,
}: SimulateTransactionArgs) => {
  const [data, setData] = useState<EstimationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stableContractArgs = useRef(contractArgs);

  const handleSimulateTransaction = useCallback(async () => {
    try {
      setIsLoading(true);
      const transactionResult = await simulateTransaction({
        contractArgs: stableContractArgs.current,
        provider,
        chain,
        nativeTokenPrice,
        nativeTokenPriceDecimals,
        tokenOut,
        routerAddress,
        quote,
        venue,
        invoice,
        priceFeedDetails,
      });
      if (transactionResult) {
        setData(transactionResult);
      }
    } catch (err) {
      setError(err as string);
    } finally {
      setIsLoading(false);
    }
  }, [
    chain,
    invoice,
    nativeTokenPrice,
    nativeTokenPriceDecimals,
    priceFeedDetails,
    provider,
    quote,
    routerAddress,
    tokenOut,
    venue,
  ]);

  useEffect(() => {
    handleSimulateTransaction();
  }, [handleSimulateTransaction]);

  return {
    ...data,
    isLoading,
    error,
  } as EstimationResult & { isLoading: boolean; error: null | string };
};

export type SwapPathState = {
  data: TokenData[];
  loading: boolean;
  error: null | string;
};

export const useSwappedTokens = () => {
  const [swapPath, setSwapPath] = useState<SwapPathState>({
    data: [],
    loading: true,
    error: null,
  });

  const { chain } = useAccount();

  const bestSwap = usePaymentStore(
    (state) => state.state.swapDetails?.bestSwap
  );

  const requestRef = useRef(0);

  const swapQuote = !!bestSwap ? bestSwap[0] : undefined;

  const fetchSwapTokens = useCallback(async () => {
    try {
      if (swapQuote?.path) {
        // ensure the latest API call gets saved
        const currentRequest = ++requestRef.current;
        setSwapPath((prevState) => ({ ...prevState, loading: true }));
        const tokens: string[] = swapQuote.path.reduce((acc, item, index) => {
          acc.push(item.tokenIn);
          if (index === swapQuote.path.length - 1) {
            acc.push(item.tokenOut);
          }
          return acc;
        }, [] as string[]);
        const fetchedTokens = await Promise.all(
          tokens.map((item) =>
            NATIVE_TOKEN_ADDRESS.toLowerCase() === item.toLowerCase()
              ? ({
                  address: item,
                  totalSupply: {
                    formatted: "",
                    value: 0n,
                  },
                  ...(chain as Chain)?.nativeCurrency,
                } as TokenData)
              : fetchToken(chain?.id ?? -1, item as `0x${string}`)
          )
        );
        if (currentRequest === requestRef.current) {
          setSwapPath((prevState) => ({
            ...prevState,
            loading: false,
            data: fetchedTokens,
          }));
        }
      }
    } catch (err) {
      setSwapPath((prevState) => ({
        ...prevState,
        loading: false,
        error: formatWagmiError(err),
      }));
    }
  }, [chain, swapQuote?.path]);

  useEffect(() => {
    fetchSwapTokens();
  }, [fetchSwapTokens, swapQuote]);

  return { ...swapPath };
};

type UseDynamicLoadingLabelProps = {
  labels?: string[];
  delay?: number;
  shouldFallback?: boolean;
  shouldStop?: boolean;
};

export const useDynamicLoadingLabel = ({
  labels = [],
  delay = 2000,
  shouldFallback = true,
  shouldStop = false,
}: UseDynamicLoadingLabelProps) => {
  const DEFAULT_LABELS = [
    "Loading",
    "Hold on tight",
    "Almost there",
    "Just a bit more",
    "Hang in there",
  ];
  const combinedLabels = shouldFallback
    ? labels.concat(DEFAULT_LABELS)
    : labels;

  const [index, setIndex] = useState(0);
  const intervalIdRef = useRef<NodeJS.Timer | null>(null);

  useEffect(() => {
    if (!shouldStop) {
      intervalIdRef.current = setInterval(() => {
        setIndex((prevState) => (prevState + 1) % combinedLabels.length);
      }, delay);
    }

    return () => {
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current as unknown as number);
      }
    };
  }, [combinedLabels.length, delay, shouldStop]);

  return combinedLabels[index];
};

export const useTokenIsSameCurrency = () => {
  const token = useMainStore((state) => state.token);
  const { invoice } = usePayment();

  return (
    invoice.currency === token?.tokenInfo.currency ||
    invoice.currency === token?.tokenInfo.symbol
  );
};

export const useGasIsSameCurrency = () => {
  const token = useMainStore((state) => state.token);
  const { chain } = useAccount();

  return (
    chain?.nativeCurrency.symbol === token?.tokenInfo.currency ||
    chain?.nativeCurrency.symbol === token?.tokenInfo.symbol
  );
};

export const useElementDimensions = (ref: React.RefObject<HTMLElement>) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (ref?.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setDimensions({ width, height });
        }
      });

      resizeObserver.observe(ref?.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.current]);

  return dimensions;
};

export const useAvailableTokens = () => {
  const { invoice } = usePayment();
  const { chain } = useAccount();

  const exchangeRates = useTokenStore((state) => state.exchangeRates);
  const tokensHeld = useTokenStore((state) => state.tokensHeld?.data);

  const tokensToDisplay = useMemo(() => {
    if (!chain?.id || !exchangeRates) {
      return [] as TokenHeld[];
    }

    const tokensWithBalance = tokensHeld?.filter((token) => token.balance > 0n);

    // We want to have the tokens accepted by the recipient at the top, swap tokens should come after
    return tokensWithBalance?.sort((a, b) => {
      const aBalanceSufficient = isBalanceSufficient(a, invoice, exchangeRates);
      const bBalanceSufficient = isBalanceSufficient(b, invoice, exchangeRates);
      // Firstly, sort by balance sufficiency
      if (aBalanceSufficient && !bBalanceSufficient) {
        return -1;
      }
      if (!aBalanceSufficient && bBalanceSufficient) {
        return 1;
      }

      // Secondly, if balance sufficiency is the same, then sort by acceptance status
      if (a.isAccepted && !b.isAccepted) {
        return -1;
      }
      if (!a.isAccepted && b.isAccepted) {
        return 1;
      }

      // If both have the same balance sufficiency and acceptance status, they're equal
      return 0;
    });
  }, [chain?.id, tokensHeld, invoice, exchangeRates]);

  const acceptedTokens = useMemo(
    () => tokensToDisplay?.filter((token) => !!token.isAccepted),
    [tokensToDisplay]
  );

  const swappableTokens = useMemo(
    () => tokensToDisplay?.filter((token) => !token.isAccepted),
    [tokensToDisplay]
  );

  return { tokensToDisplay, acceptedTokens, swappableTokens };
};

export const useTokenPrices = (filteredTokens: TokenInfo[]) => {
  const { invoice } = usePayment();
  const { chain } = useAccount();

  const requestRef = useRef(0);

  const isLoading = useTokenStore((state) => state.exchangeRates?.loading);
  const error = useTokenStore((state) => state.exchangeRates?.error);

  const setExchangeRates = useTokenStore((state) => state.setExchangeRates);
  const tokensHeld = useTokenStore((state) => state.tokensHeld?.data);
  const chainDataAPI = useMainStore((state) => state.chainDataAPI);

  const getTokenPrices = useCallback(async () => {
    try {
      // ensure the latest API call gets saved
      const currentRequest = ++requestRef.current;

      // The currency values are valid CoinGecko ids
      const currencyId = invoice.currency.toLowerCase();

      const nativeTokenInfo = coinIdToToken(
        `${chain?.nativeCurrency.symbol}-${chain?.id}`
      ) as TokenInfo;

      const tokensInIds = tokensHeld
        ?.filter((token) => !!token.tokenInfo.coinGeckoId)
        .map((token) => token.tokenInfo.coinGeckoId as string)
        .concat([currencyId, nativeTokenInfo.coinGeckoId as string]);

      const currencies = [currencyId, "usd"];
      const exchangeRates = await chainDataAPI.getExchangeRates(
        tokensInIds ?? [],
        currencies
      );

      if (currentRequest === requestRef.current) {
        const parsedExchangeRates = parseExchangeRates(
          exchangeRates,
          tokensHeld?.map((tokenHeld) => tokenHeld.tokenInfo) ?? [],
          currencyId
        );
        setExchangeRates({
          raw: exchangeRates,
          data: parsedExchangeRates,
          loading: false,
          error: null,
        });
      }
    } catch (err) {
      setExchangeRates({
        raw: null,
        data: null,
        loading: false,
        error: "Conversion failed",
      });
    }
  }, [
    chain?.id,
    chain?.nativeCurrency.symbol,
    chainDataAPI,
    invoice.currency,
    setExchangeRates,
    tokensHeld,
  ]);

  useEffect(() => {
    setExchangeRates({
      raw: null,
      data: null,
      loading: true,
      error: null,
    });
    getTokenPrices();
  }, [filteredTokens, invoice, getTokenPrices, setExchangeRates]);

  return {
    isLoading,
    error,
  };
};

export const useTokenBalances = (
  chainDataApi: IChainDataAPI,
  chainId: number | undefined,
  address: Address,
  invoiceTokens: TokenInfo[]
) => {
  const logger = useMainStore((state) => state.logger);

  const isLoading = useTokenStore((state) => state.tokensHeld?.loading);
  const error = useTokenStore((state) => state.tokensHeld?.error);
  const setTokensHeld = useTokenStore((state) => state.setTokensHeld);

  const fetchBalances = useCallback(async () => {
    if (!chainId) {
      setTokensHeld({
        data: [],
        loading: false,
        error: null,
      });
      return;
    }
    try {
      const balances = await chainDataApi.getTokenBalances(chainId, address);
      const tokensHeld = balances.map((tokenBalance) => {
        const isInvoiceAccepted = !!invoiceTokens.find(
          (invoiceToken: TokenInfo) =>
            invoiceToken.address == tokenBalance.address
        );
        const { balance, ...tokenInfo } = tokenBalance;
        return {
          tokenInfo: tokenInfo,
          balance: BigInt(balance),
          isAccepted: isInvoiceAccepted,
        } as unknown as TokenHeld;
      });

      setTokensHeld({ data: tokensHeld, loading: false, error: null });
    } catch (err) {
      logger?.error(`Failed to fetch balances: ${err}`);
      setTokensHeld({
        data: [],
        loading: false,
        error: "Failed to fetch balances",
      });
    }
  }, [address, chainDataApi, chainId, invoiceTokens, logger, setTokensHeld]);

  useEffect(() => {
    setTokensHeld({
      data: [],
      loading: true,
      error: null,
    });
    fetchBalances();
  }, [chainId, address, setTokensHeld, fetchBalances]);

  return {
    isLoading,
    error,
  };
};

export const useOnCompleteAction = (
  handleClose: () => void,
  redirectTimeout = 5000
) => {
  const { invoice } = usePayment();

  const transaction = useMainStore((state) => state.transaction);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { secondsLeft } = useCountdown(countdown ?? 0, !!countdown);

  const { data } = transaction ?? {};
  const { chain, hash, receipt, confirmed } = data ?? {};

  useEffect(() => {
    const handleOnCompleteAction = async () => {
      const action = invoice.onCompleteAction;
      if (!action) {
        return;
      }
      if (action.type === OnCompleteActionType.REDIRECT) {
        // Append chainId and txHash to URL search parameters
        const redirectUrl = new URL(action.payload.url);
        const params = new URLSearchParams(
          invoice?.onCompleteAction?.payload?.excludeParams
            ? {}
            : {
                chainId: (chain?.id ?? "").toString(),
                txHash: hash ?? "",
              }
        );
        redirectUrl.search = params.toString();
        setCountdown(redirectTimeout);
        await sleep(redirectTimeout);
        window.location.href = redirectUrl.toString();
      } else if (action.type === OnCompleteActionType.CLOSE_WINDOW) {
        setCountdown(action.payload.delayMilliseconds);
        await sleep(action.payload.delayMilliseconds);
        handleClose();
      }
    };
    if (receipt?.status === "success" && confirmed) {
      // If the data is present, the tx has succeeded
      // The transaction has completed successfully, run the onComplete action
      handleOnCompleteAction();
    }
  }, [
    redirectTimeout,
    chain?.id,
    hash,
    receipt?.status,
    confirmed,
    invoice.onCompleteAction,
    handleClose,
  ]);

  return {
    secondsLeft,
    actionType: invoice?.onCompleteAction?.type,
    actionText: invoice?.onCompleteAction?.payload?.text,
  };
};

export const useChainsWithBalance = () => {
  const { address } = useAccount();

  const logger = useMainStore((state) => state.logger);
  const setChainsWithBalance = useMainStore(
    (state) => state.setChainsWithBalance
  );
  const chainDataAPI = useMainStore((state) => state.chainDataAPI);

  useEffect(() => {
    const fetchChainsWithBalance = async () => {
      try {
        const chainsWithBalance = await chainDataAPI.getChainsWithBalance(
          address as Address
        );
        if (!!chainsWithBalance) {
          setChainsWithBalance({
            data: chainsWithBalance,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        logger?.error(`Failed to fetch chains with balance with error: ${err}`);
        // Use all available chains - we don't want to block the user if for some reason the API fails
        setChainsWithBalance({
          data: CHAINS.map((chain) => chain.chainId),
          loading: false,
          error: null,
        });
      }
    };

    if (!!address && !!chainDataAPI) {
      setChainsWithBalance({
        data: null,
        loading: true,
        error: null,
      });
      fetchChainsWithBalance();
    }
  }, [address, chainDataAPI, logger, setChainsWithBalance]);
};

export const useCountdown = (
  initialMilliseconds: number,
  shouldRun: boolean = true
) => {
  const [millisecondsLeft, setMillisecondsLeft] = useState(initialMilliseconds);
  const secondsLeft = Math.ceil(millisecondsLeft / 1000);
  const timerId = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    setMillisecondsLeft(initialMilliseconds);
  }, [initialMilliseconds]);

  useEffect(() => {
    if (millisecondsLeft > 0 && shouldRun) {
      timerId.current = setTimeout(() => {
        setMillisecondsLeft((prev) => prev - 1000);
      }, 1000);

      return () => {
        clearTimeout(timerId.current);
      };
    }
  }, [millisecondsLeft, shouldRun]);

  return {
    secondsLeft: shouldRun ? secondsLeft : null,
  };
};

export const useConnectModalClose = (onClose: () => void) => {
  const { connectModalOpen } = useConnectModal();
  // Use a ref to store the previous state of `connectModalOpen`
  const prevModalOpenRef = useRef(connectModalOpen);

  useEffect(() => {
    // Check if the modal has just closed (was open before, but now closed)
    if (prevModalOpenRef.current && !connectModalOpen) {
      onClose(); // Execute the callback
    }
    // Update the ref with the current state for the next effect execution
    prevModalOpenRef.current = connectModalOpen;
  }, [connectModalOpen, onClose]); // Depend on `connectModalOpen` and `onClose`
};
