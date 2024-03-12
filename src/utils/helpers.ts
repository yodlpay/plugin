import { NATIVE_TOKENS, NETWORK_CONSTANTS } from '@curvefi/api/lib/curve.js'
import { IPoolData } from '@curvefi/api/lib/interfaces'
import {
  AVERAGE_BLOCK_TIMES,
  AddressZero,
  CURRENCIES_WITH_PLAIN_STYLE,
  CURRENCY_SYMBOL_SPECIAL_CASES,
  CUSTOM_ABI,
  CoinConfig,
  Currency,
  DESIRED_NUMBER_OF_CONFIRMATIONS,
  Decimal,
  EstimationResult,
  ExchangeRate,
  ExchangeRates,
  IChainDataAPI,
  Invoice,
  LOCAL_RPC_URL,
  MAX_CURVE_ATTEMPTS,
  NATIVE_TOKEN_ADDRESS,
  OPTIMISM_GAS_PRICE_ORACLE,
  PaymentPayload,
  Pool,
  PriceFeedDetails,
  PricesResponse,
  Quote,
  RETURN_REMAINDER_COST,
  SimulateTransactionArgs,
  SwapVenue,
  TokenHeld,
  coinIdToToken,
  formatBalanceAmount,
  getPriceFromFeed,
  parseUnitsDecimal,
  tokenAddressToToken,
} from '@hiropay/common'
import {
  CURVE_ROUTER_ABI,
  TokenInfo,
  getChain,
  getRouter,
} from '@yodlpay/tokenlists'
import assert from 'minimalistic-assert'
import {
  Address,
  BaseError,
  Chain,
  PublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  parseAbi,
  parseAbiParameters,
  serializeTransaction,
  stringToHex,
  zeroAddress,
} from 'viem'
import { gnosis, mainnet } from 'wagmi/chains'
import { doFetch } from '../__tests__/mocks/doFetch'
import { mainStore } from '../contexts/useMainStore'
import { getRouterAbi } from '../utils/priceFeedHelpers'

// Take a simple number like '9' and convert it to
// valid 40 byte Ethereum address 0x000000000000000000000000000000009
export function padAddress(address: string): `0x${string}` {
  const padding = 40 - address.length
  return ('0x' + '0'.repeat(padding) + address) as `0x${string}`
}

export function getRouterAddress(chainId: number, version: string) {
  const mainStoreState = mainStore.getState()

  // We do not want to throw because this will break the app
  if (version === 'test') {
    if (chainId === 1) {
      return '0x447786d977Ea11Ad0600E193b2d07A06EfB53e5F' as Address
    } else {
      mainStoreState.logger?.error(
        `Testnet router not present for chain ${chainId}`,
      )
    }
  } else {
    const router = getRouter(chainId, version)
    if (!!router) {
      return router.address as Address
    } else {
      mainStoreState.logger?.error(
        `Router not present for chain ${chainId} with version ${version}`,
      )
    }
  }
}

export function tokensOfChain(tokens: TokenInfo[], chainId: number) {
  return tokens.filter((token: { chainId: any }) => token.chainId == chainId)
}

export function abiForToken(symbol: string, chainId: number) {
  if (symbol in CUSTOM_ABI && chainId in CUSTOM_ABI[symbol]) {
    return CUSTOM_ABI[symbol][chainId]
  } else {
    return erc20Abi
  }
}

export const getReceiptUrl = (
  chain: Chain | null,
  txHash: string | undefined,
) => {
  if (!chain?.id || !txHash) return ''
  return `tx/${txHash}`
}

export const parseAmountInMinorForComparison = (
  amountInMinorString: string,
  comparisonDecimals: number,
) => {
  assert(
    typeof amountInMinorString === 'string',
    'This function expects amountInMinor passed as a string',
  )
  return parseUnitsDecimal(amountInMinorString, comparisonDecimals - 2)
}

export function findTokenOut(
  tokenIn: TokenInfo,
  _recipientCoins: TokenInfo[],
): [TokenInfo | undefined, boolean] {
  const recipientCoins = _recipientCoins.filter(
    (c) => c.chainId == tokenIn.chainId,
  )
  const sameToken = recipientCoins.find((c) => c.symbol == tokenIn.symbol)
  const tokenOut = sameToken ? sameToken : recipientCoins[0]

  // if still no tokenOut found, throw an error
  if (tokenOut == undefined) {
    throw new Error('No suitable output token found')
  }

  const isSwap = tokenOut.symbol !== tokenIn.symbol

  return [tokenOut, isSwap]
}

export function parseExchangeRates(
  exchangeRates: PricesResponse,
  tokensIn: TokenInfo[],
  tokenOutId: string,
) {
  return tokensIn.reduce((accumulator, token) => {
    // Return an undefined price if we are given an invalid input/output
    if (
      !token.coinGeckoId ||
      !exchangeRates.hasOwnProperty(token.coinGeckoId)
    ) {
      accumulator[token.symbol] = undefined
      return accumulator
    }

    if (exchangeRates[token.coinGeckoId].hasOwnProperty(tokenOutId)) {
      accumulator[token.symbol] = exchangeRates[token.coinGeckoId][tokenOutId]
      return accumulator
    } else {
      // use USD prices to convert to tokenOut price
      if (
        !exchangeRates.hasOwnProperty(tokenOutId) ||
        !exchangeRates[tokenOutId].usd
      ) {
        accumulator[token.symbol] = undefined
        return accumulator
      }
      const tokenOutPrice = exchangeRates[tokenOutId].usd
      accumulator[token.symbol] =
        exchangeRates[token.coinGeckoId].usd / tokenOutPrice
      return accumulator
    }
  }, {} as ExchangeRates)
}

export async function handleSingleCurveQuote(
  amount: bigint,
  tokenInAddress: Address,
  tokenOutAddress: Address,
  provider: PublicClient | undefined,
) {
  const curveInverseQuote = await fetchSingleCurveQuote(
    amount,
    tokenOutAddress,
    tokenInAddress,
    provider,
  )

  // The Curve quote has been done inversely, so we can approximate how much of token in we should put in
  let pctIncrease = BigInt(1001)
  let amountInCurve = curveInverseQuote.amountOut as bigint
  let curveQuote = await fetchSingleCurveQuote(
    amountInCurve,
    tokenInAddress,
    tokenOutAddress,
    provider,
  )
  let attempts = 1
  while (curveQuote.amountOut < amount) {
    if (attempts >= MAX_CURVE_ATTEMPTS) {
      return undefined
    }
    pctIncrease += BigInt(1)
    amountInCurve =
      ((curveInverseQuote.amountOut as bigint) * pctIncrease) / BigInt(1000)
    curveQuote = await fetchSingleCurveQuote(
      amountInCurve,
      tokenInAddress,
      tokenOutAddress,
      provider,
    )
    attempts += 1
  }

  return curveQuote
}

export async function handleCurveClientQuote(
  amountString: string,
  tokenInAddress: Address,
  tokenInDecimals: number,
  tokenOut: TokenInfo,
  chainId: number | undefined,
  chainDataAPI: IChainDataAPI,
) {
  const curveClientInverseQuote = await chainDataAPI.getCurveQuote(
    tokenOut.address as Address,
    tokenInAddress as Address,
    amountString,
    chainId ?? -1,
  )

  if (!curveClientInverseQuote) {
    return undefined
  }

  // The Curve quote has been done inversely, so we can approximate how much of token in we should put in
  let pctIncrease = 1.001
  let amountInCurveClient = Number(curveClientInverseQuote.output)
  let curveClientQuoteRes = await chainDataAPI.getCurveQuote(
    tokenInAddress as Address,
    tokenOut.address as Address,
    amountInCurveClient,
    chainId ?? -1,
  )
  let attempts = 1
  while (!!curveClientQuoteRes && curveClientQuoteRes.output < amountString) {
    pctIncrease += 0.001
    amountInCurveClient = Number(curveClientInverseQuote.output) * pctIncrease
    curveClientQuoteRes = await chainDataAPI.getCurveQuote(
      tokenInAddress as Address,
      tokenOut.address as Address,
      amountInCurveClient,
      chainId ?? -1,
    )
    attempts += 1

    if (attempts >= MAX_CURVE_ATTEMPTS) {
      return undefined
    }
  }

  if (!curveClientQuoteRes) {
    return undefined
  }

  // Convert curve client quote to our Quote type
  return {
    path: curveClientQuoteRes.route.map((route: any) => {
      return {
        poolAddress: route.poolAddress,
        tokenIn: route.inputCoinAddress,
        tokenOut: route.outputCoinAddress,
        poolFee: '',
        swapParams: [route.i, route.j, route.swapType],
        factoryAddress: route.swapAddress, // swapAddress is a misnomer
      } as Pool
    }),
    // need to account for decimals
    amountIn: parseUnitsDecimal(
      amountInCurveClient.toString() as `${number}`,
      tokenInDecimals,
    ),
    amountOut: parseUnitsDecimal(curveClientQuoteRes.output, tokenOut.decimals),
    priceImpact: curveClientQuoteRes.priceImpact,
  }
}

export async function fetchAllQuotes(
  amount: bigint,
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
  provider: PublicClient | undefined,
  slippage: number,
  chainDataAPI: IChainDataAPI,
  excludeVenues: SwapVenue[] = [],
): Promise<[Quote, SwapVenue][]> {
  const mainStoreState = mainStore.getState()

  const chainId = await provider?.getChainId()

  // Convert slippage to a big int
  const slippageBigInt = BigInt(slippage * 10000)

  // The curve API takes the amount with decimal places
  const curveAmountString = formatUnits(amount, tokenOut.decimals)

  // Replace the native token with the wrapped token - we automatically wrap the native token
  const chainInfo = getChain(provider?.chain?.id as number)
  const tokenInAddress =
    tokenIn.symbol === provider?.chain?.nativeCurrency.symbol
      ? (chainInfo.wrappedNativeToken as Address)
      : (tokenIn.address as Address)
  const tokenOutAddress = tokenOut.address as Address
  const tokenOutAddressUniswap =
    tokenOut.symbol === provider?.chain?.nativeCurrency.symbol
      ? (chainInfo.wrappedNativeToken as Address)
      : tokenOutAddress

  // Fetch the quotes for Uniswap and Curve
  const uniswapQuotePromise: Promise<Quote | undefined> =
    !excludeVenues.includes(SwapVenue.UNISWAP)
      ? chainDataAPI.getUniswapQuote(
          tokenInAddress,
          tokenOutAddressUniswap,
          amount,
          chainId ?? -1,
        )
      : Promise.resolve(undefined)
  const curveSingleQuotePromise: Promise<Quote | undefined> =
    !excludeVenues.includes(SwapVenue.CURVE)
      ? handleSingleCurveQuote(
          amount,
          tokenInAddress,
          tokenOutAddress,
          provider,
        )
      : Promise.resolve(undefined)
  const curveQuotePromise: Promise<Quote | undefined> = !excludeVenues.includes(
    SwapVenue.CURVE,
  )
    ? handleCurveClientQuote(
        curveAmountString,
        tokenInAddress,
        tokenIn.decimals,
        tokenOut,
        chainId,
        chainDataAPI,
      )
    : Promise.resolve(undefined)
  const promises = await Promise.allSettled([
    uniswapQuotePromise,
    curveSingleQuotePromise,
    curveQuotePromise,
  ])

  let uniswapQuote, curveSingleQuote, curveQuote
  if (promises[0].status == 'fulfilled' && !!promises[0].value) {
    uniswapQuote = promises[0].value
    const amountInWithSlippage =
      (uniswapQuote.amountIn * (10000n + slippageBigInt)) / 10000n
    uniswapQuote.slippage = amountInWithSlippage - uniswapQuote.amountIn
    uniswapQuote.path[0].amountIn = amountInWithSlippage
    uniswapQuote.amountIn = amountInWithSlippage

    // We do not need to update the tokenIn for Uniswap if we are using ETH
    // (and replacing it with WETH). The router automatically detects that we
    // are sending ETH with WETH as the tokenIn and handles it.

    // Update the tokenOut with the original token address
    // This will only change the value if tokenOut is ETH/native token
    // We need this so that it identifies that we want ETH out, replaces the
    // tokenOut in the contract with WETH then unwraps it.
    uniswapQuote.path[uniswapQuote.path.length - 1].tokenOut = tokenOutAddress
  } else if (promises[0].status == 'rejected') {
    mainStoreState.logger?.error('failed to get uniswap quote')
    mainStoreState.logger?.error(promises[0].reason)
  }

  if (promises[1].status == 'fulfilled' && !!promises[1].value) {
    curveSingleQuote = promises[1].value

    // Add slippage to the curveSingleQuote
    const amountInWithSlippage =
      (curveSingleQuote.amountIn * (10000n + slippageBigInt)) / 10000n
    curveSingleQuote.slippage = amountInWithSlippage - curveSingleQuote.amountIn
    curveSingleQuote.amountIn = amountInWithSlippage

    // Finally, set the swapParams and factoryAddress for the quote
    try {
      curveSingleQuote.path[0].swapParams = determineSwapParams(
        curveSingleQuote.path[0].poolAddress,
        curveSingleQuote.path[0].tokenIn,
        curveSingleQuote.path[0].tokenOut,
        chainId,
      )
      curveSingleQuote.path[0].factoryAddress = AddressZero

      // Update the token in with the original token address
      // This will only change the value if tokenIn is ETH/native token
      curveSingleQuote.path[0].tokenIn = tokenIn.address
    } catch (err) {
      mainStoreState.logger?.error(err)
      curveSingleQuote = undefined
    }
  } else if (promises[1].status == 'rejected') {
    mainStoreState.logger?.error('failed to get single curve quote')
    mainStoreState.logger?.error(promises[1].reason)
  }

  if (promises[2].status == 'fulfilled' && !!promises[2].value) {
    curveQuote = promises[2].value

    // Add slippage to the curveQuote
    const amountInWithSlippage =
      (curveQuote.amountIn * (10000n + slippageBigInt)) / 10000n
    curveQuote.slippage = amountInWithSlippage - curveQuote.amountIn
    curveQuote.amountIn = amountInWithSlippage

    // Update the token in with the original token address
    // This will only change the value if tokenIn is ETH/native token
    curveQuote.path[0].tokenIn = tokenIn.address
  } else if (promises[2].status == 'rejected') {
    mainStoreState.logger?.error('failed to get curve quote from client')
    mainStoreState.logger?.error(promises[2].reason)
  }

  const quotes = [
    [uniswapQuote, SwapVenue.UNISWAP],
    [curveSingleQuote, SwapVenue.CURVE],
    [curveQuote, SwapVenue.CURVE],
  ] as [Quote | undefined, SwapVenue][]
  return quotes.filter(
    ([quote, _venue]) => !!quote && quote.path.length > 0,
  ) as [Quote, SwapVenue][]
}

export async function getOptimismGasCost(
  provider: PublicClient | undefined,
  chainId: number,
  gasPrice: bigint,
  args: any,
) {
  const txBytes = serializeTransaction({
    chainId: chainId,
    to: args.address,
    gasPrice,
    data: encodeFunctionData(args),
    value: args.value,
  })
  return await provider?.readContract({
    address: OPTIMISM_GAS_PRICE_ORACLE,
    abi: parseAbi(['function getL1Fee(bytes) view returns (uint256)']),
    functionName: 'getL1Fee',
    args: [txBytes],
  })
}

export async function fetchEstimates(
  quotes: [Quote, SwapVenue][],
  sender: Address,
  chain: Chain,
  invoice: any,
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
  provider: PublicClient | undefined,
  routerVersion: string,
  nativeTokenPrice: bigint,
  nativeTokenPriceDecimals: number,
  priceFeedDetails: PriceFeedDetails | null,
): Promise<EstimationResult[]> {
  const mainStoreState = mainStore.getState()

  // For each quote, create the payload and simulate the transaction
  const routerAddress = getRouterAddress(chain.id, routerVersion)
  const routerAbi = getRouterAbi(routerVersion)
  if (!routerAddress) {
    throw Error('Could not fetch YODL router address for the given chain.')
  }

  const settledPromises = await Promise.allSettled(
    quotes.map(async ([quote, venue]) => {
      // Estimate the gas
      const payload = createPayload(
        sender,
        tokenIn,
        invoice,
        chain,
        quote,
        venue,
        false,
        priceFeedDetails,
      )
      const args = {
        account: sender,
        address: routerAddress,
        abi: routerAbi,
        functionName: payload.contractFunctionName,
        args: payload.contractArgs,
        value:
          tokenIn.symbol === chain.nativeCurrency.symbol ? payload.value : 0n,
      }

      const data = await simulateTransaction({
        contractArgs: args,
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
      })
      return data as EstimationResult
    }),
  )

  // Filter out failed promises
  return settledPromises
    .map((promiseResult) => {
      if (promiseResult.status == 'fulfilled') {
        return promiseResult.value
      } else {
        mainStoreState.logger?.error({ promiseResult })
        return undefined
      }
    })
    .filter((promiseResult) => !!promiseResult) as EstimationResult[]
}

export async function fetchSwapQuote(
  sender: Address,
  chain: Chain,
  invoice: any,
  amount: bigint,
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
  provider: PublicClient,
  routerVersion: string,
  chainDataAPI: IChainDataAPI,
  excludeVenues: SwapVenue[] = [],
  nativeTokenPrice: bigint | undefined = undefined,
  nativeTokenPriceDecimals: number | undefined = undefined,
  slippage: number = 0,
  priceFeedDetails: PriceFeedDetails | null = null,
): Promise<[Quote, SwapVenue]> {
  // Get quotes for all the swap venues
  const quotes = await fetchAllQuotes(
    amount,
    tokenIn,
    tokenOut,
    provider,
    slippage,
    chainDataAPI,
    excludeVenues,
  )

  if (quotes.length === 0) {
    throw Error(
      'Failed to get quotes for both Uniswap and Curve in `fetchSwapQuotes`',
    )
  }

  let cheapestVenue
  if (!!nativeTokenPrice && !!nativeTokenPriceDecimals) {
    const gasEstimates = await fetchEstimates(
      quotes,
      sender,
      chain,
      invoice,
      tokenIn,
      tokenOut,
      provider,
      routerVersion,
      nativeTokenPrice,
      nativeTokenPriceDecimals,
      priceFeedDetails,
    )
    const cheapestVenueObject = gasEstimates.reduce(
      (cheapestVenue, currentVenue) => {
        // Get the cheapest venue in terms of amountIn
        const cheapestVenueCost =
          cheapestVenue.quote.amountIn +
          (cheapestVenue.gasInInvoiceCurrency * cheapestVenue.quote.amountIn) /
            cheapestVenue.quote.amountOut
        const currentVenueCost =
          currentVenue.quote.amountIn +
          (currentVenue.gasInInvoiceCurrency * currentVenue.quote.amountIn) /
            currentVenue.quote.amountOut
        return cheapestVenueCost < currentVenueCost
          ? cheapestVenue
          : currentVenue
      },
      gasEstimates[0],
    )
    return [cheapestVenueObject.quote, cheapestVenueObject.venue]
  } else {
    cheapestVenue = quotes.reduce((cheapestVenue, currentVenue) => {
      return cheapestVenue[0].amountIn < currentVenue[0].amountIn
        ? cheapestVenue
        : currentVenue
    }, quotes[0]) as [Quote, SwapVenue]
  }

  // We have the cheapest path for a swap (including gas if nativeToken details are provided)
  return cheapestVenue as [Quote, SwapVenue]
}

export function uniswapResponseToQuote(resJson: any): Quote {
  const pools = resJson['route'][0].map((p: any) => {
    return {
      poolAddress: p.address,
      tokenIn: p.tokenIn.address,
      tokenOut: p.tokenOut.address,
      poolFee: p.fee,
      amountIn: p.amountIn ? BigInt(p.amountIn!) : undefined,
      amountOut: p.amountOut ? BigInt(p.amountOut!) : undefined,
    } as Pool
  })

  return {
    path: pools,
    amountIn: pools[0].amountIn,
    amountOut: pools[pools.length - 1].amountOut,
    priceImpact: resJson['priceImpact'],
  } as Quote
}
export async function fetchUniswapQuote(
  amount: BigInt,
  tokenInAddress: string,
  tokenOutAddress: string,
  chainId: number,
): Promise<Quote> {
  // Handle special case for ETH
  const ethToken = coinIdToToken(`ETH-${chainId}`) as TokenInfo
  const wethToken = coinIdToToken(`WETH-${chainId}`) as TokenInfo
  if (ethToken && wethToken) {
    if (tokenInAddress === ethToken.address) {
      tokenInAddress = wethToken.address
    }
    if (tokenOutAddress === ethToken.address) {
      tokenOutAddress = wethToken.address
    }
  }
  const baseUrl = 'https://api.uniswap.org/v1/quote'
  const url = baseUrl.concat(
    '?protocols=v3',
    '&tokenInAddress=',
    tokenInAddress,
    '&tokenInChainId=',
    chainId.toString(),
    '&tokenOutAddress=',
    tokenOutAddress,
    '&tokenOutChainId=',
    chainId.toString(),
    '&amount=',
    amount.toString(),
    '&type=exactOut',
  )
  const response = await doFetch(url, {
    headers: {
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Chromium";v="112", "Brave";v="112", "Not:A-Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'sec-gpc': '1',
    },
    referrer: 'https://app.uniswap.org/',
    referrerPolicy: 'strict-origin-when-cross-origin',
    body: null,
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
  })

  if (!response.ok) {
    const error = await response.json()
    const message = error.errorCode ? error.errorCode : 'UNKNOWN_ERROR'
    throw new Error(message)
  }

  const data = await response.json()
  return uniswapResponseToQuote(data)
}

// The provider should be from the appropriate chain as the router address should be the same for all L2's
export async function fetchSingleCurveQuote(
  amount: BigInt,
  tokenInAddress: string,
  tokenOutAddress: string,
  provider: PublicClient | undefined,
): Promise<Quote> {
  // Check for invalid addresses
  if (!isAddress(tokenInAddress) || !isAddress(tokenOutAddress)) {
    throw Error('One of the token addresses is invalid.')
  }

  // Fetch the chain and get the curve router address
  if (!provider?.chain) {
    throw Error('Provider must have a chain.')
  }
  const chainInfo = getChain(provider?.chain.id)

  // Check that we have a curve router address for the chain
  if (!chainInfo || !chainInfo.curveRouterAddress) {
    throw Error(
      `Chain ${provider?.chain.id} does not have a curve router address.`,
    )
  }

  // Make a call to the contract to get the best rate
  const res = (await provider?.readContract({
    address: chainInfo.curveRouterAddress as `0x${string}`,
    abi: CURVE_ROUTER_ABI,
    functionName: 'get_best_rate',
    args: [tokenInAddress, tokenOutAddress, amount] as any[],
  })) as Array<any>

  // Should have exactly two items
  if (res.length != 2) {
    throw Error("Invalid CurveRouter 'get_best_rate' response.")
  }
  const [poolAddress, amountOut] = res

  // 0 values indicate that one of the token addresses do not exist
  if (amountOut == BigInt(0) || poolAddress === '') {
    throw Error("Token address doesn't exist for one of the tokens.")
  }

  return {
    path: [
      {
        poolAddress: poolAddress,
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        poolFee: '',
        amountIn: amount,
        amountOut: amountOut,
      } as Pool,
    ],
    amountIn: amount,
    amountOut: amountOut,
  } as Quote
}

// We need to provide the coin indices for the pool/tokens
// Different pools have slightly different swap methods and the 'exchange_multiple' method needs to know the pool type
// See 'exchange_multiple' line 497 in contracts/Swaps.vy in curve-pool-registry
export function determineSwapParams(
  poolAddress: string,
  tokenInAddress: string,
  tokenOutAddress: string,
  chainId: number | undefined,
) {
  // Check for invalid addresses
  if (!isAddress(tokenInAddress) || !isAddress(tokenOutAddress)) {
    throw Error('One of the token addresses is invalid.')
  }

  // Ensure token addresses are lower case
  tokenInAddress = tokenInAddress.toLowerCase()
  tokenOutAddress = tokenOutAddress.toLowerCase()

  if (tokenInAddress == tokenOutAddress) {
    throw Error('Tokens must not be equal.')
  }

  // Get all pools and loop through to find our pool and match its type
  const ALL_POOLS: [string, IPoolData][] = Object.entries(
    NETWORK_CONSTANTS[chainId ?? -1].POOLS_DATA,
  )
  const pool = ALL_POOLS.find(([_poolId, poolData], _i) => {
    return poolData.swap_address.toLowerCase() === poolAddress.toLowerCase()
  })

  if (pool == undefined) {
    // This can happen for factory pools (created by users, we can collect and support these later)
    throw Error('Failed to find Curve pool.')
  }
  const [poolId, poolData] = pool

  // Now that we have the pool we can determine its swap type
  // see '_findAllRoutes' method in router.ts of curve-js
  const wrapped_coin_addresses = poolData.wrapped_coin_addresses.map(
    (a: string) => a.toLowerCase(),
  )
  const underlying_coin_addresses = poolData.underlying_coin_addresses.map(
    (a: string) => a.toLowerCase(),
  )
  const base_pool = poolData.is_meta
    ? NETWORK_CONSTANTS[chainId ?? -1][poolData.base_pool as string]
    : null
  const meta_coin_addresses = base_pool
    ? base_pool.underlying_coin_addresses.map((a: string) => a.toLowerCase())
    : []

  // Ensure the tokens are both part of the pool
  if (
    !(
      wrapped_coin_addresses.includes(tokenInAddress) ||
      underlying_coin_addresses.includes(tokenInAddress)
    ) ||
    !(
      wrapped_coin_addresses.includes(tokenOutAddress) ||
      underlying_coin_addresses.includes(tokenOutAddress)
    )
  ) {
    throw Error('One or both of the tokens is not part of the pool.')
  }

  // We're going to skip swap types 7-15 as these will be disallowed (for now))
  let swapType = 0
  const inCoinIndices = {
    wrapped_coin: wrapped_coin_addresses.indexOf(tokenInAddress),
    underlying_coin: underlying_coin_addresses.indexOf(tokenInAddress),
    meta_coin: meta_coin_addresses.indexOf(tokenInAddress),
  }
  const inCoinIndex = Object.values(inCoinIndices).find((index) => index >= 0)
  const outCoinIndices = {
    wrapped_coin: wrapped_coin_addresses.indexOf(tokenOutAddress),
    underlying_coin: underlying_coin_addresses.indexOf(tokenOutAddress),
    meta_coin: meta_coin_addresses.indexOf(tokenOutAddress),
  }
  const outCoinIndex = Object.values(outCoinIndices).find((index) => index >= 0)

  // This should never throw because we have checks to ensure that both tokens are in the pool
  // But it doesn't hurt to have it
  if (inCoinIndex === undefined || outCoinIndex === undefined) {
    throw Error('Could not get coin index.')
  }

  if (inCoinIndices.wrapped_coin >= 0 && !poolData.is_fake) {
    swapType = poolData.is_crypto ? 3 : 1
  }
  if (!poolData.is_plain && inCoinIndices.underlying_coin >= 0) {
    const nativeToken = NATIVE_TOKENS[chainId ?? -1]?.['address'].toLowerCase()
    const hasEth =
      tokenInAddress === nativeToken || tokenOutAddress === nativeToken
    // We don't have any pools that are factories in the constants - so neither 5 nor 6 should occur, but we'll leave
    // the logic here for later
    swapType =
      poolData.is_crypto && poolData.is_meta && poolData.is_factory
        ? 6
        : base_pool?.is_lending && poolData.is_factory
        ? 5
        : hasEth && poolId !== 'avaxcrypto'
        ? 3
        : poolData.is_crypto
        ? 4
        : 2
  }

  if (swapType === 0) {
    throw Error('Could not find a valid swap type for the pool.')
  }

  return [inCoinIndex, outCoinIndex, swapType] as [number, number, number]
}

export function createPayloadV1(
  sender: string,
  tokenIn: TokenInfo,
  invoice: Invoice,
  chain: Chain,
  swapQuote: Quote | undefined,
  swapVenue: SwapVenue | undefined,
  priceFeedDetails: PriceFeedDetails | null = null,
): PaymentPayload {
  if (swapQuote || swapVenue) {
    throw Error('Swaps are not supported with the V1 router.')
  }

  let receiverAddress = getReceiverAddress(chain.id, tokenIn, invoice)
  if (receiverAddress === '0x0') {
    receiverAddress = sender
  }

  if (
    !!priceFeedDetails &&
    priceFeedDetails.feedAddresses.length > 1 &&
    priceFeedDetails.feedAddresses[1] != AddressZero
  ) {
    throw Error(
      'Multiple or inverse price feeds are not supported in the V1 router.',
    )
  }

  if (tokenIn.symbol === 'ETH') {
    throw Error('ETH payments are not supported in the V1 router.')
  }

  // Convert bps to divisor
  let extraFeeDivisor = 0
  if (!!invoice.extraFeeBps && invoice.extraFeeBps !== 0) {
    extraFeeDivisor = Math.round(1 / (invoice.extraFeeBps / 10000))
  }

  // In the context of a direct payment, the amount we are sending is the tokenIn
  const amount = parseAmountInMinorForComparison(
    invoice.amountInMinor.toString(),
    tokenIn.decimals,
  )

  let extraFeeAddress
  if (invoice.extraFeeAddress != zeroAddress) {
    extraFeeAddress = invoice.extraFeeAddress
  } else {
    extraFeeAddress = zeroAddress
  }

  const args = [
    stringToHex(invoice.memo ? invoice.memo : '', { size: 32 }),
    amount,
    !!priceFeedDetails ? [priceFeedDetails.feedAddresses[0]] : [],
    tokenIn.address,
    receiverAddress,
    extraFeeAddress || zeroAddress,
    extraFeeDivisor,
  ]
  return {
    tokenOut: tokenIn, // tokenOut and tokenIn are effectively the same
    contractFunctionName: 'payWithToken',
    contractArgs: args,
    isSwap: false,
    error: undefined,
    value: 0n,
  } as PaymentPayload
}

export function createPayload(
  sender: string,
  tokenIn: TokenInfo,
  invoice: Invoice,
  chain: Chain,
  swapQuote: Quote | undefined,
  swapVenue: SwapVenue | undefined,
  returnRemainder: boolean = false,
  priceFeedDetails: PriceFeedDetails | null = null,
): PaymentPayload {
  const chainInfo = getChain(chain.id)

  let receiverAddress = getReceiverAddress(chain.id, tokenIn, invoice)
  if (receiverAddress === '0x0') {
    receiverAddress = sender
  }

  // Handle direct payments
  if (!swapVenue || swapVenue == SwapVenue.NONE) {
    // In the context of a direct payment, the amount we are sending is the tokenIn
    const amount = parseAmountInMinorForComparison(
      invoice.amountInMinor.toString(),
      tokenIn.decimals,
    )

    let extraFeeAddress
    if (invoice.extraFeeAddress != zeroAddress) {
      extraFeeAddress = invoice.extraFeeAddress
    } else {
      extraFeeAddress = zeroAddress
    }

    const args = [
      stringToHex(invoice.memo ? invoice.memo : '', { size: 32 }),
      amount,
      !!priceFeedDetails
        ? priceFeedDetails.feedAddresses
        : [AddressZero, AddressZero],
      tokenIn.address,
      receiverAddress,
      extraFeeAddress || zeroAddress,
      invoice.extraFeeBps || 0,
    ]
    return {
      tokenOut: tokenIn, // tokenOut and tokenIn are effectively the same
      contractFunctionName: 'payWithToken',
      contractArgs: args,
      isSwap: false,
      error: undefined,
      // Only for ETH payments
      value:
        tokenIn.symbol === chain.nativeCurrency.symbol
          ? !!priceFeedDetails
            ? priceFeedDetails.convertedAmount
            : amount
          : 0n,
    } as PaymentPayload
  }

  // Handle swaps
  if (!swapQuote) {
    throw Error('swapQuote is not present for a payment that should be a swap.')
  }

  // Figure out the tokenOut TokenInfo
  const tokenOutAddress = swapQuote.path[swapQuote.path.length - 1].tokenOut
  const tokenOut = tokenAddressToToken(tokenOutAddress)

  if (!tokenOut) {
    // This shouldn't occur as we fetch our tokens to swap from the tokenslist
    throw Error('Could not find token out in tokenslist.')
  }

  // In the context of a swap, this is in terms of tokenOut
  const amount = parseAmountInMinorForComparison(
    invoice.amountInMinor.toString(),
    tokenOut.decimals,
  )

  if (swapVenue == SwapVenue.UNISWAP) {
    let encodeParams, encodeArgs
    if (swapQuote.path.length === 1) {
      encodeParams = parseAbiParameters('address, uint24, address')
      encodeArgs = [tokenOutAddress, swapQuote.path[0].poolFee, tokenIn.address]
    } else if (swapQuote.path.length === 2) {
      encodeParams = parseAbiParameters(
        'address, uint24, address, uint24, address',
      )
      encodeArgs = [
        swapQuote.path[1].tokenOut,
        swapQuote.path[1].poolFee,
        swapQuote.path[1].tokenIn,
        swapQuote.path[0].poolFee,
        swapQuote.path[0].tokenIn,
      ]
    } else {
      throw new Error('Invalid Uniswap path with more than two pools')
    }

    const contractArgs = [
      {
        sender: sender,
        receiver: receiverAddress,
        amountIn: swapQuote.amountIn,
        amountOut: amount,
        memo: stringToHex(invoice?.memo ?? '', { size: 32 }),
        path: encodeAbiParameters(encodeParams as any, encodeArgs),
        priceFeeds: !!priceFeedDetails
          ? priceFeedDetails.feedAddresses
          : [AddressZero, AddressZero],
        extraFeeReceiver: padAddress('0'), // TODO: add real address
        extraFeeBps: 0,
        returnRemainder,
        // 0 for single, 1 for multi
        swapType: swapQuote.path.length === 1 ? 0 : 1,
      },
    ]

    return {
      tokenOut: tokenOut,
      contractFunctionName: 'payWithUniswap',
      contractArgs: contractArgs,
      isSwap: true,
      error: undefined,
      value:
        tokenIn.symbol === chain.nativeCurrency.symbol
          ? swapQuote.amountIn
          : 0n,
    } as PaymentPayload
  } else if (swapVenue == SwapVenue.CURVE) {
    // Initialize the route and swapParams
    const route = [
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
    ]
    const swapParams = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]
    const factoryAddresses = [
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
    ]

    if (swapQuote.path.length > 4) {
      throw Error('Swap path is too long.')
    }

    for (let i = 0; i < swapQuote.path.length; i++) {
      const pool = swapQuote.path[i]

      // Set the route and swapParams
      if (i == 0) {
        if (pool.tokenIn.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()) {
          // We will automatically wrap the native token using the chains wrapped native token
          // So the swap's token in is the wrapped native token
          route[0] = chainInfo.wrappedNativeToken as Address
        } else {
          route[0] = pool.tokenIn as Address
        }
      }
      route[i * 2 + 1] = pool.poolAddress as Address
      route[i * 2 + 2] = pool.tokenOut as Address
      swapParams[i] = pool.swapParams!
      factoryAddresses[i] = pool.factoryAddress! as Address
    }

    // Check that route and swapParams have valid values
    if (
      route[0] == AddressZero ||
      route[1] == AddressZero ||
      route[2] == AddressZero ||
      (swapParams[0][0] == 0 && swapParams[0][1] == 0 && swapParams[0][2] == 0)
    ) {
      throw Error('Failed to get valid values for route and/or swapParams.')
    }

    // Create the contract args
    const contractArgs = [
      {
        sender: sender,
        receiver: receiverAddress,
        amountIn: swapQuote.amountIn,
        amountOut: amount,
        memo: stringToHex(invoice?.memo ?? '', { size: 32 }),
        route,
        swapParams,
        factoryAddresses,
        priceFeeds: !!priceFeedDetails
          ? priceFeedDetails.feedAddresses
          : [AddressZero, AddressZero],
        extraFeeReceiver: padAddress('0'), // TODO: add real address
        extraFeeBps: 0,
        returnRemainder,
      },
    ]

    return {
      tokenOut: tokenOut,
      contractFunctionName: 'payWithCurve',
      contractArgs: contractArgs,
      isSwap: true,
      error: undefined,
      value:
        tokenIn.symbol === chain.nativeCurrency.symbol
          ? swapQuote.amountIn
          : 0n,
    } as PaymentPayload
  } else {
    throw Error('Invalid swapVenue provided.')
  }
}

export function roundBigIntFixedPoint(
  bigInt: bigint,
  decimalDigits: number, // number of digits after the "decimal" point
  significantFigures: number, // number of significant figures
): string {
  // Convert the BigInt into a number with the correct decimal places
  let num = new Decimal(formatUnits(bigInt, decimalDigits))

  // Calculate the scale factor based on the number of significant figures
  const scaleFactor = Decimal.pow(
    10,
    Decimal.log10(num.abs()).floor().plus(1).minus(significantFigures),
  )

  if (scaleFactor.isZero()) {
    return '0.00'
  }

  // Round the number to the given significant figures
  num = num.dividedBy(scaleFactor).toDecimalPlaces(0).times(scaleFactor)

  // Convert the number back to a string with the correct number of decimal places
  let numStr = num.toFixed(decimalDigits)

  // Remove trailing zeros, but ensure there are always two decimal places
  numStr = numStr.replace(/(\.[0-9]+?)0+$/, '$1')

  return numStr
}

export function isProd() {
  const urlParams = new URLSearchParams(window.location.search)
  return (
    window.location.hostname === 'yodl.me' || urlParams.get('prod') === 'true'
  )
}

export const formatTokenCurrency = (minor: number) => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',

    // These options are needed to round to whole numbers if that's what you want.
    minimumFractionDigits: 2, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
    //maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
  })

  return formatter.format(minor / 100) /* $2,500.00 */
}

export const getFractionDigits = (amount: number) => {
  const decimals = amount.toString().split('.')[1]
  return decimals ? decimals.replace(/0+$/, '').length : 0
}

export const formatCurrencySymbol = (
  amount: string,
  symbol = '',
  prefix = '',
  isFiatOrStablecoin = true,
) => {
  if (isFiatOrStablecoin) {
    return `${prefix}${symbol}${amount}`
  }
  return `${prefix}${amount}${symbol ? ` ${symbol}` : ''}`
}

export const determineTokenAmount = (invoice: {
  currency: string
  amountInMinor: number
}) => {
  // If the currency is in the list of currencies that use plain style, then use
  // "decimal" instead of "currency" for the style.
  const style = CURRENCIES_WITH_PLAIN_STYLE.includes(invoice.currency)
    ? 'decimal'
    : 'currency'

  // Create a number formatter that uses the style (either "decimal" or "currency")
  // and the currency.
  const formatter = new Intl.NumberFormat('en-US', {
    style: style,
    currency: invoice.currency,

    // These options are needed to round to whole numbers if that's what you want.
    minimumFractionDigits: 2, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
    //maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
  })

  // Format the amount in minor units into the native currency.
  const nativeFormatted = formatter.format(
    new Decimal(invoice.amountInMinor).dividedBy(new Decimal(100)).toNumber(),
  )

  return nativeFormatted
}

export const getTokenOutInfo = (invoice: Invoice, chain: Chain | undefined) => {
  const chainConfig = invoice.coins.find(
    (config) => config.chainId === chain?.id,
  ) as CoinConfig
  const token = chainConfig.tokens[0]
  return coinIdToToken(`${token.symbol}-${chain?.id}`) as TokenInfo
}

export const determineMostExpensiveSwap = (quotes: [Quote, SwapVenue][]) =>
  quotes.reduce((mostExpensive, current) => {
    return mostExpensive[0].amountIn > current[0].amountIn
      ? mostExpensive
      : current
  }, quotes[0])

export const determineCheapestSwapWithoutGas = (quotes: [Quote, SwapVenue][]) =>
  quotes.reduce((minSwap, currentSwap) => {
    return minSwap[0].amountIn < currentSwap[0].amountIn ? minSwap : currentSwap
  }, quotes[0])

export const determineCheapestSwapWithGas = (estimates: EstimationResult[]) =>
  estimates.reduce((cheapestSwap, currentSwap) => {
    // Convert values to amountIn
    const cheapestSwapReturnDelta = cheapestSwap.shouldReturnRemainder
      ? (cheapestSwap.returnRemainderDelta * cheapestSwap.quote.amountIn) /
        cheapestSwap.quote.amountOut
      : 0n
    const cheapestSwapCost =
      cheapestSwap.quote.amountIn +
      (cheapestSwap.gasInInvoiceCurrency * cheapestSwap.quote.amountIn) /
        cheapestSwap.quote.amountOut +
      cheapestSwapReturnDelta
    const currentSwapReturnDelta = currentSwap.shouldReturnRemainder
      ? (currentSwap.returnRemainderDelta * currentSwap.quote.amountIn) /
        currentSwap.quote.amountOut
      : 0n
    const currentSwapCost =
      currentSwap.quote.amountIn +
      (currentSwap.gasInInvoiceCurrency * currentSwap.quote.amountIn) /
        currentSwap.quote.amountOut +
      currentSwapReturnDelta
    return cheapestSwapCost < currentSwapCost ? cheapestSwap : currentSwap
  }, estimates[0])

export const getMockWalletClient = (
  address: string | null,
  key: string | null,
) =>
  createWalletClient({
    transport: http(LOCAL_RPC_URL),
    chain: mainnet,
    account: !!address
      ? (address as `0x${string}`)
      : '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // 1st dev account
    key: !!key
      ? key
      : '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    pollingInterval: 100,
  })

export const formatWagmiError = (
  err: unknown,
  shouldFallback: boolean = true,
) => {
  if (err instanceof BaseError) {
    if (err.details?.includes('already pending')) {
      return 'Network switch already pending. Check your wallet'
    }
    return err?.shortMessage ?? 'Something went wrong'
  }
  if (err && typeof err === 'object') {
    if ('message' in err) {
      if (typeof err.message === 'string') {
        return err.message
      }
    }
  }
  return shouldFallback ? 'Something went wrong' : (err as string)
}

export const getChainNativeCurrency = (chain: Chain) => {
  // Special case for gnosis which has xDAI (DAI) as its native token
  if (chain.id === gnosis.id) {
    return 'DAI'
  } else {
    return chain.nativeCurrency.symbol
  }
}

export const isBalanceSufficient = (
  token: TokenHeld,
  invoice: Invoice,
  exchangeRates: ExchangeRate | null,
  skipConversionIfRateUndefined: boolean = true,
) => {
  if (skipConversionIfRateUndefined) return true
  const { rawAmount } = formatConvertedBalance(
    token,
    exchangeRates?.data?.[token.tokenInfo.symbol],
    invoice,
  )
  const requiredAmount = new Decimal(invoice.amountInMinor)
    .dividedBy(new Decimal(100))
    .toNumber()
  return rawAmount && rawAmount >= requiredAmount
}

export const isAllowanceSufficient = (
  balance: bigint,
  rawAmountIn: bigint,
): boolean => {
  return !!balance && !!rawAmountIn && balance >= rawAmountIn
}

export const tokenAmountToHuman = (
  balance: bigint | Decimal,
  decimals: number,
) => {
  const divisor = 10 ** decimals
  const balanceAmount = Number(balance)

  const balanceHuman = balanceAmount / divisor
  const balanceSanitized = Math.abs(balanceHuman)

  return new Decimal(balanceSanitized)
}

export const formatBalance = (
  balance: bigint,
  decimals: number,
  symbol: string = '',
) => {
  if (balance) {
    const divisor = 10 ** decimals
    const balanceAmount = Number(balance)

    const balanceHuman = balanceAmount / divisor
    const balanceSanitized = Math.abs(balanceHuman)

    return formatBalanceAmount({
      amount: balanceSanitized,
      isFiatOrStablecoin: false,
      ...(symbol && { symbol }),
    })
  }
  return formatBalanceAmount({ amount: 0, isFiatOrStablecoin: false })
}

export const formatConvertedBalance = (
  tokenHeld: TokenHeld,
  exchangeRate: number | undefined,
  invoice: Invoice,
) => {
  if (!tokenHeld) {
    return { rawAmount: 0, formattedAmount: 0, currency: '', isLoading: true }
  }

  const calculateAmounts = (balance: BigInt, currency: string) => {
    const rawAmount = Number(balance) / 10 ** tokenHeld.tokenInfo.decimals
    const formattedAmount = formatBalanceAmount({
      amount: rawAmount,
      currency,
      isFiatOrStablecoin: !CURRENCY_SYMBOL_SPECIAL_CASES.includes(currency),
      converted: true,
    })
    return { rawAmount, formattedAmount }
  }

  let balance = tokenHeld.balance

  if (tokenHeld.tokenInfo.currency === invoice.currency) {
    return {
      ...calculateAmounts(balance, invoice.currency),
      currency: invoice.currency,
      isLoading: false,
    }
  }

  if (exchangeRate !== undefined) {
    const exchangeRateBigInt = parseUnitsDecimal(
      new Decimal(exchangeRate).toString(),
      18,
    )
    balance = (balance * exchangeRateBigInt) / 10n ** 18n
    return {
      ...calculateAmounts(balance, invoice.currency),
      currency: invoice.currency,
      isLoading: false,
    }
  }

  return { isLoading: true }
}

export const normalizeBigInt = (amount: bigint, decimals: number) => {
  const divisor = 10 ** decimals

  const normalizedAmount = Number(amount) / divisor

  return normalizedAmount
}

export const getEstimatedTime = (
  chainId: number,
  numberOfConfirmations = DESIRED_NUMBER_OF_CONFIRMATIONS,
): number => {
  const DEFAULT_DURATION = 120
  return AVERAGE_BLOCK_TIMES[chainId]
    ? AVERAGE_BLOCK_TIMES[chainId] * numberOfConfirmations
    : DEFAULT_DURATION
}

export const areCurrenciesEqual = (invoice: Invoice, token: TokenHeld | null) =>
  (CURRENCY_SYMBOL_SPECIAL_CASES.includes(invoice.currency) &&
    CURRENCY_SYMBOL_SPECIAL_CASES.includes(token?.tokenInfo.symbol ?? '')) ||
  invoice.currency === token?.tokenInfo.currency

export const simulateTransaction = async ({
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
  if (
    !chain ||
    nativeTokenPrice === undefined ||
    nativeTokenPriceDecimals === undefined
  ) {
    return
  }

  if (!routerAddress) {
    throw Error('Could not fetch YODL router address for the given chain.')
  }

  const invoiceAmount = parseAmountInMinorForComparison(
    invoice.amountInMinor.toString(),
    tokenOut.decimals,
  )

  let invoiceFeedPrice = 100000000n
  let invoiceFeedDecimals = 8

  if (invoice.currency !== Currency.USD) {
    // Get the price feed for USD->invoice currency
    const chainInfo = getChain(chain?.id ?? -1)
    const feedAddress = chainInfo.priceFeeds?.[invoice.currency]
    if (!feedAddress) {
      throw Error('Feed address not present for invoice currency')
    }
    ;[invoiceFeedPrice, invoiceFeedDecimals] = await getPriceFromFeed(
      provider,
      feedAddress as Address,
    )
  }

  const gasPrice = await provider?.getGasPrice()

  const [gas, simulationRes, l1GasCost] = await Promise.all([
    provider?.estimateContractGas(contractArgs),
    provider?.simulateContract(contractArgs),
    chain?.id === 10
      ? getOptimismGasCost(provider, chain?.id, gasPrice ?? 0n, contractArgs)
      : 0n,
  ])

  // Calculate the cost of gas in USD in terms of token out (USD based token)
  // We want this as a function because the right hand side by which we multiply the amount is less than 0 as a bigint
  const gasCostInUsd = (amount: bigint) =>
    (amount * nativeTokenPrice) /
    10n ** BigInt(nativeTokenPriceDecimals) /
    10n ** BigInt(chain.nativeCurrency.decimals - tokenOut.decimals)

  // Calculate the remainder - for now tokenOut will be a currency
  // The remainder depends on the swap venue:
  // - tokenIn for Uniswap
  // - tokenOut for Curve
  // The values in terms of invoice currency will have the same number of decimals as tokenOut
  let remainder
  let remainderInInvoiceCurrency
  if (venue === SwapVenue.UNISWAP) {
    const amountSpent = simulationRes?.result as unknown as bigint
    remainder = quote.amountIn - amountSpent
    remainderInInvoiceCurrency = (remainder * quote.amountOut) / quote.amountIn
  } else if (venue === SwapVenue.CURVE) {
    const amountReceived = simulationRes?.result as unknown as bigint
    remainder = amountReceived - invoiceAmount
    remainderInInvoiceCurrency = remainder
  } else if (venue === SwapVenue.NONE) {
    remainder = 0n
    remainderInInvoiceCurrency = 0n
  } else {
    throw Error(`Unhandled swap venue ${venue}`)
  }
  if (
    !!priceFeedDetails &&
    priceFeedDetails.approximateRate &&
    invoice.currency !== Currency.ETH
  ) {
    // Convert remainder to the invoice currency if we have price feed data
    // Do not convert if our invoice currency is ETH, it will already be in ETH
    remainderInInvoiceCurrency =
      (remainder * priceFeedDetails.approximateRate) / 10n ** 8n
  }

  // Calculate how much it costs to return the remainder and determine if it is worth returning
  const returnRemainderCostUsd = gasCostInUsd(
    RETURN_REMAINDER_COST * (gasPrice ?? 0n),
  )

  // Fetch the price of the gas in terms of invoice currency and amount in
  const gasInUsd = gasCostInUsd(
    (gas as bigint) * (gasPrice ?? 0n) + (l1GasCost ?? 0n),
  )

  // Convert prices, if necessary
  const returnRemainderCost =
    invoice.currency === Currency.ETH
      ? RETURN_REMAINDER_COST * (gasPrice ?? 0n)
      : (returnRemainderCostUsd * invoiceFeedPrice) /
        10n ** BigInt(invoiceFeedDecimals)

  const gasInInvoiceCurrency =
    invoice.currency === Currency.ETH
      ? (gas as bigint) * (gasPrice ?? 0n) + (l1GasCost ?? 0n)
      : (gasInUsd * invoiceFeedPrice) / 10n ** BigInt(invoiceFeedDecimals)

  return {
    quote,
    venue,
    gas,
    gasInInvoiceCurrency,
    gasInUsd,
    gasPrice,
    remainderInInvoiceCurrency,
    returnRemainderCost,
    returnRemainderDelta: remainderInInvoiceCurrency - returnRemainderCost,
    shouldReturnRemainder: remainderInInvoiceCurrency > returnRemainderCost,
    tokenOut,
  } as EstimationResult
}

export const capitalizeWord = (word: string) => {
  if (!word) return word
  return word[0].toUpperCase() + word.substr(1).toLowerCase()
}

export const getReceiverAddress = (
  chainId: number,
  tokenIn: TokenInfo,
  invoice: Invoice,
) => {
  const chainConfig = invoice.coins.find(
    (coinConfig) => coinConfig.chainId === chainId,
  )
  if (!chainConfig) {
    return invoice.recipientAddress
  }

  const tokenConfig = chainConfig.tokens.find(
    (token) => token.symbol === tokenIn.symbol,
  )

  if (tokenConfig && tokenConfig.address) {
    return tokenConfig.address
  } else if (chainConfig.defaultAddress) {
    return chainConfig.defaultAddress
  } else {
    return invoice.recipientAddress
  }
}

export const determineTokenCurrency = (
  isSwapPayment: boolean,
  token: TokenHeld | null,
  tokenOut: TokenInfo,
) => {
  return isSwapPayment
    ? tokenOut.currency ?? tokenOut.symbol
    : token?.tokenInfo.currency ?? token?.tokenInfo.symbol ?? ''
}
