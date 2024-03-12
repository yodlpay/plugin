import {
  AddressZero,
  Currency,
  LOCAL_RPC_URL,
  PaymentType,
  PriceFeedDetails,
  Quote,
  RETURN_REMAINDER_COST,
  SwapVenue,
  coinIdToToken,
  coinIdsToCoinConfig,
  formatBalanceAmount,
  formatPaymentAmount,
  getPriceFromFeed,
} from '@hiropay/common'
import { ChainInfo, TokenInfo } from '@yodlpay/tokenlists'
import {
  Address,
  ContractFunctionExecutionError,
  createPublicClient,
  http,
} from 'viem'
import { mainnet } from 'viem/chains'
import { describe, it, vi } from 'vitest'
import {
  curveClientResponse,
  curveResponseProvider,
  uniswapV3Response,
} from '../__tests__/helpers'
import * as DoFetch from '../__tests__/mocks/doFetch'
import { createHttpServer } from '../components/__tests__/utils/helpers'
import { BrowserChainDataAPI } from '../utils/browserChainDataAPI'
import {
  fetchEstimates,
  fetchSwapQuote,
  roundBigIntFixedPoint,
} from '../utils/helpers'
import { getPriceFeeds } from '../utils/priceFeedHelpers'

describe('fetchSwapQuote', () => {
  const chainId = 1
  const USDT = coinIdToToken('USDT-1') as TokenInfo
  const WBTC: TokenInfo = {
    chainId,
    address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    name: 'Wrapped BTC',
    decimals: 8,
    symbol: 'WBTC',
  } as TokenInfo
  const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address
  const INVOICE = {
    memo: '',
    amountInMinor: 100,
    recipientAddress: '0x0',
    extraFeeAddress: null,
    extraFeeBps: null,
    currency: 'USD',
    coins: coinIdsToCoinConfig(['USDT-1', 'USDC-1']),
  }
  const NATIVE_TOKEN_PRICE = 190000000000n // $1900/ETH
  const NATIVE_TOKEN_PRICE_DECIMALS = 8
  const SLIPPAGE = 0.001 // 0.1%
  const browserChainDataAPI = new BrowserChainDataAPI()

  beforeEach(() => {
    browserChainDataAPI.setCurveClient(undefined)
  })

  it('should return the cheaper uniswap quote without gas calculations (no curve client)', async () => {
    const amount = BigInt(100000000) // 100 USD

    // set it up so uniswap is cheaper
    const uniswapResponse = uniswapV3Response(
      '89000000',
      amount.toString(),
      [WBTC, USDT],
      ['0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'],
      [500],
    )
    vi.spyOn(DoFetch, 'doFetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(uniswapResponse),
      } as Response),
    )

    const provider = await curveResponseProvider([
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', BigInt(90000000)],
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', amount],
    ])

    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(100000000000000n) // 0.0001 ETH
    })

    const quote = await fetchSwapQuote(
      SENDER,
      provider.chain,
      INVOICE,
      amount,
      WBTC,
      USDT,
      provider,
      'test',
      browserChainDataAPI,
    )
    expect(quote).toEqual([
      {
        path: [
          {
            poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
            poolFee: '500',
            amountIn: BigInt(89000000),
            amountOut: amount,
            tokenIn: WBTC.address,
            tokenOut: USDT.address,
          },
        ],
        amountIn: BigInt(89000000),
        amountOut: amount,
        priceImpact: undefined,
        slippage: 0n,
      },
      SwapVenue.UNISWAP,
    ])
  })

  it('should return the cheaper uniswap quote without gas calculations and a curve client', async () => {
    const amount = BigInt(100000000) // 100 USD

    // set it up so uniswap is cheaper
    const uniswapResponse = uniswapV3Response(
      '89000000',
      amount.toString(),
      [WBTC, USDT],
      ['0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'],
      [500],
    )
    vi.spyOn(DoFetch, 'doFetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(uniswapResponse),
      } as Response),
    )

    const provider = await curveResponseProvider([
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', BigInt(90000000)],
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', amount],
    ])

    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(100000000000000n) // 0.0001 ETH
    })

    const curveAmountsOut = ['100', '90'] // from the end first
    const curveClient = {
      provider: { chainId },
      chainId,
      router: {
        async getBestRouteAndOutput(
          tokenInAddress: string,
          tokenOutAddress: string,
          _amount: string,
        ) {
          return curveClientResponse(
            tokenInAddress,
            tokenOutAddress,
            curveAmountsOut.pop() || '0.0',
          )
        },
      },
    }
    browserChainDataAPI.setCurveClient(curveClient)

    const quote = await fetchSwapQuote(
      SENDER,
      provider.chain,
      INVOICE,
      amount,
      WBTC,
      USDT,
      provider,
      'test',
      browserChainDataAPI,
      [],
      undefined,
      undefined,
    )
    expect(quote).toEqual([
      {
        path: [
          {
            poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
            poolFee: '500',
            amountIn: BigInt(89000000),
            amountOut: amount,
            tokenIn: WBTC.address,
            tokenOut: USDT.address,
          },
        ],
        amountIn: BigInt(89000000),
        amountOut: amount,
        priceImpact: undefined,
        slippage: 0n,
      },
      SwapVenue.UNISWAP,
    ])
  })

  it('should return the cheaper curve quote without gas calculations (no curve client)', async () => {
    const amount = BigInt(100000000) // 100 USD

    // set it up so curve is cheaper
    const uniswapResponse = uniswapV3Response(
      '91000000',
      amount.toString(),
      [WBTC, USDT],
      ['0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'],
      [500],
    )
    vi.spyOn(DoFetch, 'doFetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(uniswapResponse),
      } as Response),
    )

    const provider = await curveResponseProvider([
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', BigInt(90000000)],
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', amount],
    ])

    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(100000000000000n) // 0.0001 ETH
    })

    const quote = await fetchSwapQuote(
      SENDER,
      provider.chain,
      INVOICE,
      amount,
      WBTC,
      USDT,
      provider,
      'test',
      browserChainDataAPI,
    )
    expect(quote).toEqual([
      {
        path: [
          {
            poolAddress: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
            poolFee: '',
            amountIn: BigInt(90000000),
            amountOut: amount,
            tokenIn: WBTC.address,
            tokenOut: USDT.address,
            factoryAddress: '0x0000000000000000000000000000000000000000',
            swapParams: [1, 0, 4],
          },
        ],
        amountIn: BigInt(90000000),
        amountOut: amount,
        slippage: 0n,
      },
      SwapVenue.CURVE,
    ])
  })

  it('should return the cheaper curve client quote without gas calculations', async () => {
    const amount = BigInt(100000000) // 100 USD

    // set it up so curve is cheaper
    const uniswapResponse = uniswapV3Response(
      '91000000',
      amount.toString(),
      [WBTC, USDT],
      ['0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'],
      [500],
    )
    vi.spyOn(DoFetch, 'doFetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(uniswapResponse),
      } as Response),
    )

    const provider = await curveResponseProvider([
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', BigInt(90000000)],
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', amount],
    ])

    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(100000000000000n) // 0.0001 ETH
    })

    const curveAmountsOut = ['100', '0.89'] // from the end first
    const curveClient = {
      provider: { chainId },
      chainId,
      router: {
        async getBestRouteAndOutput(
          tokenInAddress: string,
          tokenOutAddress: string,
          _amount: string,
        ) {
          return curveClientResponse(
            tokenInAddress,
            tokenOutAddress,
            curveAmountsOut.pop() || '0.0',
          )
        },
        async priceImpact(
          _tokenInAddress: string,
          _tokenOutAddress: string,
          _amount: string,
        ) {
          return 0.1
        },
      },
    }
    browserChainDataAPI.setCurveClient(curveClient)

    const quote = await fetchSwapQuote(
      SENDER,
      provider.chain,
      INVOICE,
      amount,
      WBTC,
      USDT,
      provider,
      'test',
      browserChainDataAPI,
      [],
      undefined,
      undefined,
    )
    expect(quote).toEqual([
      {
        path: [
          {
            poolAddress: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
            poolFee: '',
            tokenIn: WBTC.address,
            tokenOut: USDT.address,
            factoryAddress: '0x0000000000000000000000000000000000000000',
            swapParams: [2, 0, 1],
          },
        ],
        amountIn: 89000000n,
        amountOut: amount,
        priceImpact: 0.1,
        slippage: 0n,
      },
      SwapVenue.CURVE,
    ])
  })

  it('should return the uniswap quote due to curve gas being too expensive (no curve client)', async () => {
    const amount = BigInt(100000000) // 100 USD

    // set it up so curve is cheaper
    const uniswapResponse = uniswapV3Response(
      '91000000',
      amount.toString(),
      [WBTC, USDT],
      ['0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'],
      [500],
    )
    vi.spyOn(DoFetch, 'doFetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(uniswapResponse),
      } as Response),
    )

    const provider = await curveResponseProvider([
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', BigInt(90000000)],
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', amount],
    ])

    //
    vi.spyOn(provider, 'estimateContractGas').mockImplementation((params) => {
      if (params.functionName === 'payWithCurve') {
        // return higher gas
        return Promise.resolve(1000000000000000000n) // 1ETH
      } else {
        // return negligible gas for uniswap
        return Promise.resolve(1n)
      }
    })

    vi.spyOn(provider, 'getGasPrice').mockImplementation(() => {
      return Promise.resolve(15000000000n) // 15GWei
    })

    vi.spyOn(provider, 'simulateContract').mockImplementation(() => {
      return Promise.resolve({ result: amount } as any)
    })

    const quote = await fetchSwapQuote(
      SENDER,
      provider.chain,
      INVOICE,
      amount,
      WBTC,
      USDT,
      provider,
      'test',
      browserChainDataAPI,
      [],
      NATIVE_TOKEN_PRICE,
      NATIVE_TOKEN_PRICE_DECIMALS,
    )
    expect(quote).toEqual([
      {
        path: [
          {
            poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
            poolFee: '500',
            amountIn: BigInt(91000000),
            amountOut: amount,
            tokenIn: WBTC.address,
            tokenOut: USDT.address,
          },
        ],
        amountIn: BigInt(91000000),
        amountOut: amount,
        priceImpact: undefined,
        slippage: 0n,
      },
      SwapVenue.UNISWAP,
    ])
  })

  it("should return the uniswap quote if curve doesn't have a quote", async () => {
    const amount = BigInt(100000000) // 100 USD

    // curve shouldn't have a quote
    const uniswapResponse = uniswapV3Response(
      '91000000',
      amount.toString(),
      [WBTC, USDT],
      ['0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'],
      [500],
    )
    vi.spyOn(DoFetch, 'doFetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(uniswapResponse),
      } as Response),
    )

    const provider = await curveResponseProvider([['0', BigInt(0)]])

    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(100000000000000n) // 0.0001 ETH
    })

    vi.spyOn(provider, 'simulateContract').mockImplementation(() => {
      return Promise.resolve({ result: amount } as any)
    })

    const quote = await fetchSwapQuote(
      SENDER,
      provider.chain,
      INVOICE,
      amount,
      WBTC,
      USDT,
      provider,
      'test',
      browserChainDataAPI,
      [],
      NATIVE_TOKEN_PRICE,
      NATIVE_TOKEN_PRICE_DECIMALS,
    )
    expect(quote).toEqual([
      {
        path: [
          {
            poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
            poolFee: '500',
            amountIn: BigInt(91000000),
            amountOut: amount,
            tokenIn: WBTC.address,
            tokenOut: USDT.address,
          },
        ],
        amountIn: BigInt(91000000),
        amountOut: amount,
        priceImpact: undefined,
        slippage: 0n,
      },
      SwapVenue.UNISWAP,
    ])
  })

  it("should return the curve quote if uniswap doesn't have a quote", async () => {
    const amount = BigInt(100000000) // 100 USD

    // uniswap shouldn't have a quote
    vi.spyOn(DoFetch, 'doFetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(undefined),
      } as Response),
    )
    const curveResponse = {
      pool: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
      amountIn: 90090000n, // 0.9009 BTC
      amountOut: amount, // 100.25 USD
    }
    const provider = await curveResponseProvider([
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', BigInt(89000000)],
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', curveResponse.amountOut],
    ])

    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(100000000000000n) // 0.0001 ETH
    })

    vi.spyOn(provider, 'simulateContract').mockImplementation((args) => {
      if (args.functionName == 'payWithCurve') {
        return Promise.resolve({ result: curveResponse.amountOut } as any)
      } else if (args.functionName == 'payWithUniswap') {
        return Promise.resolve({ result: amount } as any)
      } else {
        return Promise.resolve({ result: 0n } as any)
      }
    })

    const quote = await fetchSwapQuote(
      SENDER,
      provider.chain,
      INVOICE,
      amount,
      WBTC,
      USDT,
      provider,
      'test',
      browserChainDataAPI,
      [],
    )
    expect(quote).toEqual([
      {
        path: [
          {
            poolAddress: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
            poolFee: '',
            amountIn: 89000000n,
            amountOut: amount,
            tokenIn: WBTC.address,
            tokenOut: USDT.address,
            factoryAddress: '0x0000000000000000000000000000000000000000',
            swapParams: [1, 0, 4],
          },
        ],
        amountIn: 89000000n,
        amountOut: amount,
        slippage: 0n,
      },
      SwapVenue.CURVE,
    ])
  })

  it("should return the curve client quote if uniswap/curve doesn't have a quote", async () => {
    const amount = BigInt(100000000) // 100 USD

    // uniswap shouldn't have a quote
    vi.spyOn(DoFetch, 'doFetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(undefined),
      } as Response),
    )
    const provider = await curveResponseProvider([['0', BigInt(0)]])

    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(100000000000000n) // 0.0001 ETH
    })

    const curveAmountsOut = ['100', '0.90'] // from the end first
    const curveClient = {
      provider: { chainId },
      chainId,
      router: {
        async getBestRouteAndOutput(
          tokenInAddress: string,
          tokenOutAddress: string,
          _amount: string,
        ) {
          return curveClientResponse(
            tokenInAddress,
            tokenOutAddress,
            curveAmountsOut.pop() || '0.0',
          )
        },
        async priceImpact(
          _tokenInAddress: string,
          _tokenOutAddress: string,
          _amount: string,
        ) {
          return 0.1
        },
      },
    }
    browserChainDataAPI.setCurveClient(curveClient)

    vi.spyOn(provider, 'simulateContract').mockImplementation(() => {
      return Promise.resolve({ result: amount } as any)
    })

    const quote = await fetchSwapQuote(
      SENDER,
      provider.chain,
      INVOICE,
      amount,
      WBTC,
      USDT,
      provider,
      'test',
      browserChainDataAPI,
      [],
      NATIVE_TOKEN_PRICE,
      NATIVE_TOKEN_PRICE_DECIMALS,
    )
    expect(quote).toEqual([
      {
        path: [
          {
            poolAddress: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
            poolFee: '',
            tokenIn: WBTC.address,
            tokenOut: USDT.address,
            factoryAddress: '0x0000000000000000000000000000000000000000',
            swapParams: [2, 0, 1],
          },
        ],
        amountIn: 90000000n,
        amountOut: amount,
        priceImpact: 0.1,
        slippage: 0n,
      },
      SwapVenue.CURVE,
    ])
  })

  it('should throw an error if neither swap venue has a quote', async () => {
    const amount = BigInt(100000000) // 100 USD

    // neither should have a quote
    vi.spyOn(DoFetch, 'doFetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(undefined),
      } as Response),
    )
    const server = await createHttpServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
      })
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x0' }))
    })
    const provider = createPublicClient({
      chain: mainnet,
      transport: http(server.url),
    })
    vi.spyOn(provider, 'getChainId').mockImplementation(() =>
      Promise.resolve(1),
    )

    await expect(() =>
      fetchSwapQuote(
        SENDER,
        provider.chain,
        INVOICE,
        amount,
        WBTC,
        USDT,
        provider,
        'test',
        browserChainDataAPI,
        [],
        NATIVE_TOKEN_PRICE,
        NATIVE_TOKEN_PRICE_DECIMALS,
      ),
    ).rejects.toThrowError(
      'Failed to get quotes for both Uniswap and Curve in `fetchSwapQuotes`',
    )
  })

  it('should return a uniswap quote correctly with slippage', async () => {
    const amount = BigInt(100000000) // 100 USD

    // set it up so uniswap is cheaper
    const uniswapResponse = uniswapV3Response(
      '89000000',
      amount.toString(),
      [WBTC, USDT],
      ['0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'],
      [500],
    )
    vi.spyOn(DoFetch, 'doFetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(uniswapResponse),
      } as Response),
    )

    const provider = await curveResponseProvider([
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', BigInt(90000000)],
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', amount],
    ])

    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(100000000000000n) // 0.0001 ETH
    })

    const quote = await fetchSwapQuote(
      SENDER,
      provider.chain,
      INVOICE,
      amount,
      WBTC,
      USDT,
      provider,
      'test',
      browserChainDataAPI,
      [],
      undefined,
      undefined,
      SLIPPAGE,
    )
    const slippage = (89000000n * BigInt(SLIPPAGE * 10000)) / 10000n
    const amountInWithSlippage = 89000000n + slippage
    expect(quote).toEqual([
      {
        path: [
          {
            poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
            poolFee: '500',
            amountIn: amountInWithSlippage,
            amountOut: amount,
            tokenIn: WBTC.address,
            tokenOut: USDT.address,
          },
        ],
        amountIn: amountInWithSlippage,
        amountOut: amount,
        priceImpact: undefined,
        slippage,
      },
      SwapVenue.UNISWAP,
    ])
  })

  it('should return a curve quote correctly with slippage', async () => {
    const amount = BigInt(100000000) // 100 USD

    // set it up so curve is cheaper
    const uniswapResponse = uniswapV3Response(
      '91000000',
      amount.toString(),
      [WBTC, USDT],
      ['0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'],
      [500],
    )
    vi.spyOn(DoFetch, 'doFetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(uniswapResponse),
      } as Response),
    )

    const provider = await curveResponseProvider([
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', BigInt(90000000)],
      ['0xd51a44d3fae010294c616388b506acda1bfaae46', amount],
    ])

    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(100000000000000n) // 0.0001 ETH
    })

    const curveAmountsOut = ['100', '0.89'] // from the end first
    const curveClient = {
      provider: { chainId },
      chainId,
      router: {
        async getBestRouteAndOutput(
          tokenInAddress: string,
          tokenOutAddress: string,
          _amount: string,
        ) {
          return curveClientResponse(
            tokenInAddress,
            tokenOutAddress,
            curveAmountsOut.pop() || '0.0',
          )
        },
        async priceImpact(
          _tokenInAddress: string,
          _tokenOutAddress: string,
          _amount: string,
        ) {
          return 0.1
        },
      },
    }
    browserChainDataAPI.setCurveClient(curveClient)

    const quote = await fetchSwapQuote(
      SENDER,
      provider.chain,
      INVOICE,
      amount,
      WBTC,
      USDT,
      provider,
      'test',
      browserChainDataAPI,
      [],
      undefined,
      undefined,
      SLIPPAGE,
    )
    const slippage = (89000000n * BigInt(SLIPPAGE * 10000)) / 10000n
    const amountInWithSlippage = 89000000n + slippage
    expect(quote).toEqual([
      {
        path: [
          {
            poolAddress: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
            poolFee: '',
            tokenIn: WBTC.address,
            tokenOut: USDT.address,
            factoryAddress: '0x0000000000000000000000000000000000000000',
            swapParams: [2, 0, 1],
          },
        ],
        amountIn: amountInWithSlippage,
        amountOut: amount,
        priceImpact: 0.1,
        slippage,
      },
      SwapVenue.CURVE,
    ])
  })

  it('should correctly exclude venues', async () => {
    const amount = BigInt(100000000) // 100 USD
    const provider = await curveResponseProvider([])

    await expect(() =>
      fetchSwapQuote(
        SENDER,
        provider.chain,
        INVOICE,
        amount,
        WBTC,
        USDT,
        provider,
        'test',
        browserChainDataAPI,
        [SwapVenue.UNISWAP, SwapVenue.CURVE],
        undefined,
        undefined,
        SLIPPAGE,
      ),
    ).rejects.toThrow(
      'Failed to get quotes for both Uniswap and Curve in `fetchSwapQuotes`',
    )
  })
})

describe('getPriceFromFeed', () => {
  it('should correctly return the price from a valid ChainLink feed', async () => {
    const provider = createPublicClient({
      chain: mainnet,
      transport: http(LOCAL_RPC_URL),
    })
    vi.spyOn(provider, 'readContract').mockImplementation((args) => {
      if (args.functionName === 'latestRoundData') {
        return Promise.resolve([
          110680464442257312868n,
          196231984384n,
          1688381747n,
          1688381747n,
          110680464442257312868n,
        ])
      } else if (args.functionName === 'decimals') {
        return Promise.resolve(8)
      }
      return Promise.resolve()
    })
    const [exchangeRate, decimals] = await getPriceFromFeed(
      provider,
      '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' as Address,
    )
    expect(exchangeRate).toBe(196231984384n)
    expect(decimals).toBe(8)
  })

  it('should throw an error if the address is invalid', async () => {
    const provider = createPublicClient({
      chain: mainnet,
      transport: http(LOCAL_RPC_URL),
    })
    vi.spyOn(provider, 'readContract').mockImplementation(() =>
      Promise.reject(ContractFunctionExecutionError),
    )
    await expect(() =>
      getPriceFromFeed(
        provider,
        '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8429' as Address, // invalid address
      ),
    ).rejects.toThrow('Failed to fetch latestRoundData from feed.')
  })

  it('should throw an error if the latestRoundData call succeeds but the decimal call fails', async () => {
    const provider = createPublicClient({
      chain: mainnet,
      transport: http(LOCAL_RPC_URL),
    })
    vi.spyOn(provider, 'readContract').mockImplementation((args) => {
      if (args.functionName === 'latestRoundData') {
        return Promise.resolve([
          110680464442257312868n,
          196231984384n,
          1688381747n,
          1688381747n,
          110680464442257312868n,
        ])
      } else if (args.functionName === 'decimals') {
        return Promise.reject(ContractFunctionExecutionError)
      }
      return Promise.resolve()
    })
    await expect(() =>
      getPriceFromFeed(
        provider,
        '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8429' as Address, // invalid address
      ),
    ).rejects.toThrow('Failed to fetch exchange rate decimals from feed.')
  })
})

describe('fetchEstimates', () => {
  const USDT = coinIdToToken('USDT-1') as TokenInfo
  const WBTC: TokenInfo = {
    chainId: 1,
    address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    name: 'Wrapped BTC',
    decimals: 8,
    symbol: 'WBTC',
  } as TokenInfo
  const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address
  const INVOICE = {
    memo: '',
    amountInMinor: 100000,
    recipientAddress: '0x0',
    extraFeeAddress: null,
    extraFeeBps: null,
    currency: 'USD',
    coins: coinIdsToCoinConfig(['USDT-1', 'USDC-1']),
  }
  const NATIVE_TOKEN_PRICE = 190000000000n // $1900/ETH
  const NATIVE_TOKEN_PRICE_DECIMALS = 8

  it('should return a quote that correctly determines it should return the remainder', async () => {
    const amountOut = 1000000000n // 1000USD - this excludes the fee
    const quotes = [
      [
        {
          path: [
            {
              poolAddress: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
              poolFee: '',
              tokenIn: WBTC.address,
              tokenOut: USDT.address,
              factoryAddress: '0x0000000000000000000000000000000000000000',
              swapParams: [2, 0, 1],
            },
          ],
          amountIn: BigInt(90000000), // 0.9BTC
          amountOut,
        },
        SwapVenue.CURVE,
      ],
    ] as [Quote, SwapVenue][]
    const provider = createPublicClient({
      chain: mainnet,
      transport: http(LOCAL_RPC_URL),
    })

    // Set up mocks
    const gasPrice = 15000000000n // 15GWei
    vi.spyOn(provider, 'getGasPrice').mockImplementation(() => {
      return Promise.resolve(gasPrice)
    })

    const gasEstimate = 400000n
    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(gasEstimate)
    })

    const simulatedAmountOut = (amountOut * 101n) / 100n // 1% more than the amount out
    vi.spyOn(provider, 'simulateContract').mockImplementation(() => {
      return Promise.resolve({ result: simulatedAmountOut } as any)
    })

    const estimates = await fetchEstimates(
      quotes,
      SENDER,
      provider.chain,
      INVOICE,
      WBTC,
      USDT,
      provider,
      'test',
      NATIVE_TOKEN_PRICE,
      NATIVE_TOKEN_PRICE_DECIMALS,
      null,
    )

    expect(estimates.length).toBe(1)
    const estimate = estimates[0]
    expect(estimate.quote).toBe(quotes[0][0])
    expect(estimate.venue).toBe(SwapVenue.CURVE)
    expect(estimate.gas).toBe(gasEstimate)
    expect(estimate.gasPrice).toBe(gasPrice)

    const gasInUsd =
      (gasEstimate * gasPrice * NATIVE_TOKEN_PRICE) /
      10n ** BigInt(NATIVE_TOKEN_PRICE_DECIMALS) /
      10n ** BigInt(mainnet.nativeCurrency.decimals - USDT.decimals)
    expect(estimate.gasInInvoiceCurrency).toBe(gasInUsd)

    // There is no fee
    const remainder = simulatedAmountOut - amountOut
    expect(estimate.remainderInInvoiceCurrency).toBe(remainder)

    const returnRemainderCost =
      (RETURN_REMAINDER_COST * gasPrice * NATIVE_TOKEN_PRICE) /
      10n ** BigInt(NATIVE_TOKEN_PRICE_DECIMALS) /
      10n ** BigInt(mainnet.nativeCurrency.decimals - USDT.decimals)
    expect(estimate.returnRemainderCost).toBe(returnRemainderCost)
    expect(estimate.returnRemainderDelta).toBeGreaterThan(0n)
    expect(estimate.shouldReturnRemainder).toBe(true)
  })

  it('should correctly apply the fee for an invoice with a memo for curve', async () => {
    const amountOut = 1000000000n // 1000USD - this excludes the fee
    const quotes = [
      [
        {
          path: [
            {
              poolAddress: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
              poolFee: '',
              tokenIn: WBTC.address,
              tokenOut: USDT.address,
              factoryAddress: '0x0000000000000000000000000000000000000000',
              swapParams: [2, 0, 1],
            },
          ],
          amountIn: BigInt(90000000), // 0.9BTC
          amountOut,
        },
        SwapVenue.CURVE,
      ],
    ] as [Quote, SwapVenue][]
    const provider = createPublicClient({
      chain: mainnet,
      transport: http(LOCAL_RPC_URL),
    })

    // Set up mocks
    const gasPrice = 15000000000n // 15GWei
    vi.spyOn(provider, 'getGasPrice').mockImplementation(() => {
      return Promise.resolve(gasPrice)
    })

    const gasEstimate = 400000n
    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(gasEstimate)
    })

    const simulatedAmountOut = (amountOut * 101n) / 100n // 1% more than the amount out
    vi.spyOn(provider, 'simulateContract').mockImplementation(() => {
      return Promise.resolve({ result: simulatedAmountOut } as any)
    })

    const invoice = {
      ...INVOICE,
      memo: 'something',
    }
    const estimates = await fetchEstimates(
      quotes,
      SENDER,
      provider.chain,
      invoice,
      WBTC,
      USDT,
      provider,
      'test',
      NATIVE_TOKEN_PRICE,
      NATIVE_TOKEN_PRICE_DECIMALS,
      null,
    )

    expect(estimates.length).toBe(1)
    const estimate = estimates[0]
    // should be the amount out with the fee included
    const remainder = simulatedAmountOut - amountOut
    expect(estimate.remainderInInvoiceCurrency).toBe(remainder)

    const returnRemainderCost =
      (RETURN_REMAINDER_COST * gasPrice * NATIVE_TOKEN_PRICE) /
      10n ** BigInt(NATIVE_TOKEN_PRICE_DECIMALS) /
      10n ** BigInt(mainnet.nativeCurrency.decimals - USDT.decimals)
    expect(estimate.returnRemainderCost).toBe(returnRemainderCost)
    expect(estimate.returnRemainderDelta).toBeGreaterThan(0n)
    expect(estimate.shouldReturnRemainder).toBe(true)
  })

  it('should correctly apply the fee for an invoice with a memo for uniswap', async () => {
    const amountIn = 90000000n // 0.9BTC
    const amountOut = 1000000000n // 1000USD - this excludes the fee
    const quotes = [
      [
        {
          path: [
            {
              poolAddress: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
              poolFee: '',
              tokenIn: WBTC.address,
              tokenOut: USDT.address,
            },
          ],
          amountIn,
          amountOut,
        },
        SwapVenue.UNISWAP,
      ],
    ] as [Quote, SwapVenue][]
    const provider = createPublicClient({
      chain: mainnet,
      transport: http(LOCAL_RPC_URL),
    })

    // Set up mocks
    const gasPrice = 15000000000n // 15GWei
    vi.spyOn(provider, 'getGasPrice').mockImplementation(() => {
      return Promise.resolve(gasPrice)
    })

    const gasEstimate = 400000n
    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(gasEstimate)
    })

    const simulatedAmountSpent = (amountIn * 99n) / 100n // ~1% less than the amount out
    vi.spyOn(provider, 'simulateContract').mockImplementation(() => {
      return Promise.resolve({ result: simulatedAmountSpent } as any)
    })

    const invoice = {
      ...INVOICE,
      memo: 'something',
    }
    const estimates = await fetchEstimates(
      quotes,
      SENDER,
      provider.chain,
      invoice,
      WBTC,
      USDT,
      provider,
      'test',
      NATIVE_TOKEN_PRICE,
      NATIVE_TOKEN_PRICE_DECIMALS,
      null,
    )

    expect(estimates.length).toBe(1)
    const estimate = estimates[0]
    // remainder will be in WBTC
    const remainder = amountIn - simulatedAmountSpent
    const remainderInInvoiceCurrency = (remainder * amountOut) / amountIn
    expect(estimate.remainderInInvoiceCurrency).toBe(remainderInInvoiceCurrency)

    const returnRemainderCost =
      (RETURN_REMAINDER_COST * gasPrice * NATIVE_TOKEN_PRICE) /
      10n ** BigInt(NATIVE_TOKEN_PRICE_DECIMALS) /
      10n ** BigInt(mainnet.nativeCurrency.decimals - USDT.decimals)
    expect(estimate.returnRemainderCost).toBe(returnRemainderCost)
    expect(estimate.returnRemainderDelta).toBeGreaterThan(0n)
    expect(estimate.shouldReturnRemainder).toBe(true)
  })

  it('should return an estimate for a non-USD invoice', async () => {
    const amountOut = 1000000000n // 1000USD - this excludes the fee
    const quotes = [
      [
        {
          path: [
            {
              poolAddress: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
              poolFee: '',
              tokenIn: WBTC.address,
              tokenOut: USDT.address,
              factoryAddress: '0x0000000000000000000000000000000000000000',
              swapParams: [2, 0, 1],
            },
          ],
          amountIn: BigInt(90000000), // 0.9BTC
          amountOut,
        },
        SwapVenue.CURVE,
      ],
    ] as [Quote, SwapVenue][]
    const provider = createPublicClient({
      chain: mainnet,
      transport: http(LOCAL_RPC_URL),
    })

    // Set up mocks
    const gasPrice = 15000000000n // 15GWei
    vi.spyOn(provider, 'getGasPrice').mockImplementation(() => {
      return Promise.resolve(gasPrice)
    })

    const gasEstimate = 400000n
    vi.spyOn(provider, 'estimateContractGas').mockImplementation(() => {
      return Promise.resolve(gasEstimate)
    })

    const simulatedAmountOut = (amountOut * 101n) / 100n // 1% more than the amount out
    vi.spyOn(provider, 'simulateContract').mockImplementation(() => {
      return Promise.resolve({ result: simulatedAmountOut } as any)
    })

    const price = 90000000n
    const decimals = 8
    vi.spyOn(provider, 'readContract').mockImplementation((args) => {
      if (args.functionName === 'latestRoundData') {
        return Promise.resolve([0n, price, 0n, 0n, 0n])
      } else if (args.functionName === 'decimals') {
        return Promise.resolve(decimals)
      }
      return Promise.resolve()
    })

    const invoice = {
      ...INVOICE,
      currency: Currency.EUR,
    }

    const estimates = await fetchEstimates(
      quotes,
      SENDER,
      provider.chain,
      invoice,
      WBTC,
      USDT,
      provider,
      'test',
      NATIVE_TOKEN_PRICE,
      NATIVE_TOKEN_PRICE_DECIMALS,
      {
        feedAddresses: [AddressZero],
        approximateRate: price,
        convertedAmount: 0n,
      } as PriceFeedDetails,
    )

    expect(estimates.length).toBe(1)
    const estimate = estimates[0]
    expect(estimate.quote).toBe(quotes[0][0])
    expect(estimate.venue).toBe(SwapVenue.CURVE)
    expect(estimate.gas).toBe(gasEstimate)
    expect(estimate.gasPrice).toBe(gasPrice)

    const gasInUsd =
      (gasEstimate * gasPrice * NATIVE_TOKEN_PRICE) /
      10n ** BigInt(NATIVE_TOKEN_PRICE_DECIMALS) /
      10n ** BigInt(mainnet.nativeCurrency.decimals - USDT.decimals)
    const gasInNativeCurrency = (gasInUsd * price) / 10n ** BigInt(decimals)
    expect(estimate.gasInInvoiceCurrency).toBe(gasInNativeCurrency)

    // There is no fee
    const remainder = simulatedAmountOut - amountOut
    const remainderInInvoiceCurrency =
      (remainder * price) / 10n ** BigInt(decimals)
    expect(estimate.remainderInInvoiceCurrency).toBe(remainderInInvoiceCurrency)

    const returnRemainderCost =
      (RETURN_REMAINDER_COST * gasPrice * NATIVE_TOKEN_PRICE) /
      10n ** BigInt(NATIVE_TOKEN_PRICE_DECIMALS) /
      10n ** BigInt(mainnet.nativeCurrency.decimals - USDT.decimals)
    const returnRemainderCostInInvoiceCurrency =
      (returnRemainderCost * price) / 10n ** BigInt(decimals)
    expect(estimate.returnRemainderCost).toBe(
      returnRemainderCostInInvoiceCurrency,
    )
    expect(estimate.returnRemainderDelta).toBeGreaterThan(0n)
    expect(estimate.shouldReturnRemainder).toBe(true)
  })
})

describe('roundBigIntFixedPoint', () => {
  it('should correctly round', () => {
    expect(roundBigIntFixedPoint(1007358934656766650n, 18, 6)).toBe('1.00736')
    expect(roundBigIntFixedPoint(26767n, 6, 2)).toBe('0.027')
    expect(roundBigIntFixedPoint(10000n, 2, 2)).toBe('100.0')
    expect(roundBigIntFixedPoint(1n, 2, 2)).toBe('0.01')
    expect(roundBigIntFixedPoint(0n, 2, 2)).toBe('0.00')
    expect(roundBigIntFixedPoint(1n, 6, 2)).toBe('0.000001')
  })
})

describe('getPriceFeeds', () => {
  const chainPriceFeeds = {
    EUR: '0xEUR',
    GBP: '0xGBP',
  }
  const chainInfo = {
    chainId: 1,
    chainName: 'ETH',
    shortName: 'eth',
    logoUri: '',
    explorerUrl: '',
    rpcUrls: [],
    testnet: false,
    priceFeeds: chainPriceFeeds,
    wrappedNativeToken: '0x0',
  } as ChainInfo

  it('should return a single address for a direct payment of EURe tokens for a USD invoice', () => {
    const priceFeeds = getPriceFeeds(
      chainInfo,
      Currency.USD,
      coinIdToToken('EURe-1') as TokenInfo,
      PaymentType.DIRECT,
    )
    // EURe / EUR/USD Rate = USD
    expect(priceFeeds).toStrictEqual([
      AddressZero,
      chainPriceFeeds[Currency.EUR],
    ])
  })

  it('should return a single address for a direct payment of USDC for a EUR invoice', () => {
    const priceFeeds = getPriceFeeds(
      chainInfo,
      Currency.EUR,
      coinIdToToken('USDC-1') as TokenInfo,
      PaymentType.DIRECT,
    )
    // USDC * EUR/USD Rate = EUR
    expect(priceFeeds).toStrictEqual([
      chainPriceFeeds[Currency.EUR],
      AddressZero,
    ])
  })

  it('should return multiple addresses for a direct payment of EURe tokens for a GBP invoice', () => {
    const priceFeeds = getPriceFeeds(
      chainInfo,
      Currency.GBP,
      coinIdToToken('EURe-1') as TokenInfo,
      PaymentType.DIRECT,
    )
    // EURe * GBP/USD Rate / EUR/USD Rate = GBP
    expect(priceFeeds).toStrictEqual([
      chainPriceFeeds[Currency.GBP],
      chainPriceFeeds[Currency.EUR],
    ])
  })

  it('should return an empty array if the currencies are the same', () => {
    const priceFeeds = getPriceFeeds(
      chainInfo,
      Currency.USD,
      coinIdToToken('USDC-1') as TokenInfo,
      PaymentType.DIRECT,
    )
    expect(priceFeeds).toStrictEqual([])
  })

  it('should return an empty array if the token is not a stablecoin', () => {
    const priceFeeds = getPriceFeeds(
      chainInfo,
      Currency.USD,
      {
        chainId: 1,
        address: '0x1',
        name: 'SHIB',
        decimals: 8,
        symbol: 'SHIB',
      } as TokenInfo,
      PaymentType.DIRECT,
    )
    expect(priceFeeds).toStrictEqual([])
  })

  it('should return a single address for a swap payment with token out EURe for a USD invoice', () => {
    const priceFeeds = getPriceFeeds(
      chainInfo,
      Currency.USD,
      coinIdToToken('EURe-1') as TokenInfo,
      PaymentType.SWAP,
    )
    // USD * EUR/USD Rate = EURe token out amount
    expect(priceFeeds).toStrictEqual([
      chainPriceFeeds[Currency.EUR],
      AddressZero,
    ])
  })

  it('should return a single address for a swap payment with token out USDC for a EUR invoice', () => {
    const priceFeeds = getPriceFeeds(
      chainInfo,
      Currency.EUR,
      coinIdToToken('USDC-1') as TokenInfo,
      PaymentType.SWAP,
    )
    // EUR / EUR/USD Rate = USDC token out amount
    expect(priceFeeds).toStrictEqual([
      AddressZero,
      chainPriceFeeds[Currency.EUR],
    ])
  })

  it('should return multiple addresses for a swap payment of EURe tokens for a GBP invoice', () => {
    const priceFeeds = getPriceFeeds(
      chainInfo,
      Currency.GBP,
      coinIdToToken('EURe-1') as TokenInfo,
      PaymentType.SWAP,
    )
    // GBP * EUR/USD rate / GBP/USD rate = EUR token out amount
    expect(priceFeeds).toStrictEqual([
      chainPriceFeeds[Currency.EUR],
      chainPriceFeeds[Currency.GBP],
    ])
  })
})

const AMOUNTS = [
  0.00012345, 0.00012003, 0.018, 0.12345, 0.9, 1.1, 1.4, 1.4, 1.4055, 12.34,
  123.45, 1000, 1234.56, 12345.67, 123456.78, 1234567.89, 12345678.9,
  123456789.01, 1234567890.12, 12345678901.23,
]

describe('formatBalanceAmount', () => {
  it('should format balance amounts correctly', () => {
    const expectedBalanceValues = [
      '<0.01',
      '<0.01',
      '<0.01',
      '0.1',
      '0.9',
      '1.1',
      '1.4',
      '1.4',
      '1.4',
      '12.3',
      '123.4',
      '1,000',
      '1,234.5',
      '12,345.6',
      '123,456.7',
      '~1.2M',
      '~12M',
      '~123M',
      '~1.2B',
      '~12B',
    ]

    AMOUNTS.forEach((amount, index) => {
      const result = formatBalanceAmount({ amount, isFiatOrStablecoin: false })
      expect(result).toBe(expectedBalanceValues[index])
    })
  })

  it('should format USD converted balance amounts correctly', () => {
    const expectedConvertedBalanceValues = [
      '<$0.01',
      '<$0.01',
      '~$0.01',
      '~$0.12',
      '~$0.90',
      '~$1.10',
      '~$1.40',
      '~$1.40',
      '~$1.40',
      '~$12.34',
      '~$123.45',
      '~$1,000.00',
      '~$1,234.56',
      '~$12,345.67',
      '~$123,456.78',
      '~$1.2M',
      '~$12M',
      '~$123M',
      '~$1.2B',
      '~$12B',
    ]

    AMOUNTS.forEach((amount, index) => {
      const result = formatBalanceAmount({
        amount,
        currency: 'USD',
        converted: true,
      })
      expect(result).toBe(expectedConvertedBalanceValues[index])
    })
  })

  it('should format ETH converted balance amounts correctly', () => {
    const expectedConvertedBalanceValues = [
      '<0.01 ETH',
      '<0.01 ETH',
      '<0.01 ETH',
      '~0.1 ETH',
      '~0.9 ETH',
      '~1.1 ETH',
      '~1.4 ETH',
      '~1.4 ETH',
      '~1.4 ETH',
      '~12.3 ETH',
      '~123.4 ETH',
      '~1,000 ETH',
      '~1,234.5 ETH',
      '~12,345.6 ETH',
      '~123,456.7 ETH',
      '~1.2M ETH',
      '~12M ETH',
      '~123M ETH',
      '~1.2B ETH',
      '~12B ETH',
    ]

    AMOUNTS.forEach((amount, index) => {
      const result = formatBalanceAmount({
        amount,
        currency: 'ETH',
        isFiatOrStablecoin: false,
        converted: true,
      })
      expect(result).toBe(expectedConvertedBalanceValues[index])
    })
  })
})

describe('formatPaymentAmount', () => {
  it('should format payment amounts correctly', () => {
    const expectedPaymentValues = [
      '0.01',
      '0.01',
      '0.02',
      '0.13',
      '0.90',
      '1.11',
      '1.40',
      '1.40',
      '1.41',
      '12.34',
      '123.45',
      '1,000.00',
      '1,234.56',
      '12,345.67',
      '123,456.78',
      '1,234,567.89',
      '12,345,678.90',
      '123,456,789.01',
      '1,234,567,890.12',
      '12,345,678,901.23',
    ]

    AMOUNTS.forEach((amount, index) => {
      const result = formatPaymentAmount({ amount })
      expect(result).toBe(expectedPaymentValues[index])
    })
  })

  it('should format EUR payment amounts correctly', () => {
    const expectedPaymentValues = [
      '€0.01',
      '€0.01',
      '€0.02',
      '€0.13',
      '€0.90',
      '€1.11',
      '€1.40',
      '€1.40',
      '€1.41',
      '€12.34',
      '€123.45',
      '€1,000.00',
      '€1,234.56',
      '€12,345.67',
      '€123,456.78',
      '€1,234,567.89',
      '€12,345,678.90',
      '€123,456,789.01',
      '€1,234,567,890.12',
      '€12,345,678,901.23',
    ]

    AMOUNTS.forEach((amount, index) => {
      const result = formatPaymentAmount({ amount, currency: 'EUR' })
      expect(result).toBe(expectedPaymentValues[index])
    })
  })

  it('should format ETH payment amounts correctly', () => {
    const expectedPaymentValues = [
      '0.000124 ETH',
      '0.000121 ETH',
      '0.018 ETH',
      '0.12345 ETH',
      '0.9 ETH',
      '1.1 ETH',
      '1.4 ETH',
      '1.4 ETH',
      '1.4055 ETH',
      '12.34 ETH',
      '123.45 ETH',
      '1,000 ETH',
      '1,234.56 ETH',
      '12,345.67 ETH',
      '123,456.78 ETH',
      '1,234,567.89 ETH',
      '12,345,678.9 ETH',
      '123,456,789.01 ETH',
      '1,234,567,890.12 ETH',
      '12,345,678,901.23 ETH',
    ]

    AMOUNTS.forEach((amount, index) => {
      const result = formatPaymentAmount({
        amount,
        currency: 'ETH',
        isFiatOrStablecoin: false,
      })
      expect(result).toBe(expectedPaymentValues[index])
    })
  })

  it('should handle higher precision for small fiat amounts', () => {
    const smallAmounts = [0.0001, 0.0009, 0.0045, 0.01]
    const expectedSmallAmounts = ['0.0001', '0.0009', '0.0045', '0.01']
    smallAmounts.forEach((amount, index) => {
      const result = formatPaymentAmount({
        amount,
        useHigherPrecisionForSmallAmounts: true,
      })
      expect(result).toBe(expectedSmallAmounts[index])
    })
  })

  it('should handle higher precision for small fiat amounts with exceeding decimal points', () => {
    const smallAmounts = [0.0001012, 0.000906, 0.0045547, 0.01]
    const expectedSmallAmounts = ['0.000102', '0.000906', '0.004555', '0.01']
    smallAmounts.forEach((amount, index) => {
      const result = formatPaymentAmount({
        amount,
        useHigherPrecisionForSmallAmounts: true,
      })
      expect(result).toBe(expectedSmallAmounts[index])
    })
  })

  it('should not handle higher precision for small fiat amounts with exceeding decimal points when useHigherPrecisionForSmallAmounts is false', () => {
    const smallAmounts = [0.0001012, 0.000906, 0.0045547, 0.01]
    const expectedSmallAmounts = ['0.01', '0.01', '0.01', '0.01']
    smallAmounts.forEach((amount, index) => {
      const result = formatPaymentAmount({
        amount,
      })
      expect(result).toBe(expectedSmallAmounts[index])
    })
  })

  it('should obey precision argument for fiat', () => {
    const amount = 1234.5678
    const result = formatPaymentAmount({
      amount,
      precision: 4,
    })
    expect(result).toBe('1,234.5678')
  })

  it('should obey precision argument for fiat with exceeding precision decimal points', () => {
    const amount = 1234.567801
    const result = formatPaymentAmount({
      amount,
      precision: 4,
    })
    expect(result).toBe('1,234.5679')
  })

  it('should obey precision argument for tokens', () => {
    const amount = 0.123456789
    const result = formatPaymentAmount({
      amount,
      currency: 'ETH',
      isFiatOrStablecoin: false,
      precision: 4,
    })
    expect(result).toBe('0.1235 ETH')
  })

  it('should not format currency when shouldFormatCurrency is false', () => {
    const amount = 1234.567
    const result = formatPaymentAmount({
      amount,
      shouldFormatCurrency: false,
    })
    expect(result).toBe('1,234.57')
  })

  it('should round token amounts according to TOKEN_DECIMALS', () => {
    const amount = 0.123456789
    const result = formatPaymentAmount({
      amount,
      currency: 'ETH',
      isFiatOrStablecoin: false,
    })
    expect(result).toBe('0.123457 ETH')
  })

  it('should round fiat amounts according to FIAT_DECIMALS', () => {
    const amount = 1234.567
    const result = formatPaymentAmount({
      amount,
    })
    expect(result).toBe('1,234.57')
  })

  it('should format symbol correctly', () => {
    const amount = 1000
    const result = formatPaymentAmount({
      amount,
      symbol: '$$',
    })
    expect(result).toBe('$$1,000.00')
  })

  it('should use higher precision for small fiat amounts when useHigherPrecisionForSmallAmounts is true', () => {
    const amount = 0.0001234
    const result = formatPaymentAmount({
      amount,
      isFiatOrStablecoin: true,
      useHigherPrecisionForSmallAmounts: true,
    })
    expect(result).toBe('0.000124')
  })

  it('should not use higher precision for small fiat amounts when useHigherPrecisionForSmallAmounts is false', () => {
    const amount = 0.0001234
    const result = formatPaymentAmount({
      amount,
      isFiatOrStablecoin: true,
      useHigherPrecisionForSmallAmounts: false,
    })
    expect(result).toBe('0.01')
  })

  it('should not use higher precision for small token amounts even when useHigherPrecisionForSmallAmounts is true', () => {
    const amount = 0.0001234
    const result = formatPaymentAmount({
      amount,
      currency: 'ETH',
      isFiatOrStablecoin: false,
      useHigherPrecisionForSmallAmounts: true,
    })
    expect(result).toBe('0.000124 ETH')
  })

  it('should not use higher precision for small token amounts when useHigherPrecisionForSmallAmounts is false', () => {
    const amount = 0.0001234
    const result = formatPaymentAmount({
      amount,
      currency: 'ETH',
      isFiatOrStablecoin: false,
      useHigherPrecisionForSmallAmounts: false,
    })
    expect(result).toBe('0.000124 ETH')
  })
})
