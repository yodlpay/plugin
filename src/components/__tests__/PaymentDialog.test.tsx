import { NETWORK_CONSTANTS } from "@curvefi/api/lib/curve";
import { IPoolData } from "@curvefi/api/lib/interfaces";
import { coinIdToToken } from "@hiropay/common";
import { TokenInfo } from "@yodlpay/tokenlists";
import { createPublicClient, http } from "viem";
import { goerli, mainnet } from "viem/chains";
import { vi } from "vitest";
import {
  curveResponseProvider,
  uniswapV3Response,
} from "../../__tests__/helpers";
import * as DoFetch from "../../__tests__/mocks/doFetch";
import {
  determineSwapParams,
  fetchSingleCurveQuote,
  fetchUniswapQuote,
  findTokenOut,
} from "../../utils/helpers";

// const swapFuncAbi = HIRO_ROUTER_ABIS["test"].find(
//   (func: { name: string }) => func.name === "payWithUniswap"
// )!;
// //@ts-ignore
// const SwapStruct = swapFuncAbi["inputs"][0] as ParamType;

describe("PaymentDialog", () => {
  const WETH = {
    name: "Wrapped ETH",
    chainId: 1,
    decimals: 18,
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    symbol: "WETH",
  } as TokenInfo;
  const HEX = {
    name: "Hex",
    chainId: 1,
    decimals: 8,
    address: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
    symbol: "HEX",
  } as TokenInfo;
  const FTM = {
    name: "Fantom",
    chainId: 1,
    decimals: 18,
    address: "0x4E15361FD6b4BB609Fa63C81A2be19d873717870",
    symbol: "FTM",
  } as TokenInfo;
  const USDT = {
    name: "Tether",
    symbol: "USDT",
    address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    decimals: 6,
    chainId: 1,
  } as TokenInfo;
  const USDZ = {
    name: "Z USD",
    symbol: "USDZ",
    address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    decimals: 6,
    chainId: 1,
  } as TokenInfo;
  const USDC = coinIdToToken("USDC-1") as TokenInfo;

  test("handle uniswap api errors", async () => {
    const invalidRouteResponse = {
      detail: "No route found",
      errorCode: "NO_ROUTE",
      id: "a2af9",
    };

    vi.spyOn(DoFetch, "doFetch").mockImplementation(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve(invalidRouteResponse),
      } as Response)
    );
    await expect(() =>
      fetchUniswapQuote(
        BigInt("1000000"),
        "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
        "0xC2C527C0CACF457746Bd31B2a698Fe89de2b6d49",
        1
      )
    ).rejects.toThrowError("NO_ROUTE");
  });

  test("parse uniswap quote", async () => {
    const singleHopResponse = uniswapV3Response(
      "574205524587861",
      "1000000",
      [WETH, USDC],
      ["0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640"],
      [500]
    );

    vi.spyOn(DoFetch, "doFetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(singleHopResponse),
      } as Response)
    );
    const quote = await fetchUniswapQuote(
      BigInt("1000000"),
      "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
      "0xC2C527C0CACF457746Bd31B2a698Fe89de2b6d49",
      1
    );
    const pool = quote.path[0];
    expect(pool).toEqual({
      tokenIn: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      tokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      poolFee: "500",
      amountIn: BigInt("574205524587861"),
      amountOut: BigInt(1000000),
      poolAddress: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
    });

    const multihopResponse = uniswapV3Response(
      "3600441989",
      "1000000",
      [HEX, WETH, FTM],
      [
        "0x82743c07BF3Be4d55876F87bca6cce5F84429bD0",
        "0x64652315D86f5dfAE30885FBD29D1da05b63ADD7",
      ],
      [10000, 3000]
    );

    vi.spyOn(DoFetch, "doFetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(multihopResponse),
      } as Response)
    );
    const multiQuote = await fetchUniswapQuote(
      BigInt("1000000"),
      "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
      "0xC2C527C0CACF457746Bd31B2a698Fe89de2b6d49",
      1
    );
    const [pool1, pool2] = multiQuote.path;
    expect(pool1).toEqual({
      tokenIn: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
      tokenOut: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      poolFee: "10000",
      poolAddress: "0x82743c07BF3Be4d55876F87bca6cce5F84429bD0",
      amountIn: BigInt("3600441989"),
    });

    expect(pool2).toEqual({
      amountIn: undefined,
      amountOut: BigInt(1000000),
      tokenIn: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      tokenOut: "0x4E15361FD6b4BB609Fa63C81A2be19d873717870",
      poolFee: "3000",
      poolAddress: "0x64652315D86f5dfAE30885FBD29D1da05b63ADD7",
    });

    expect(multiQuote.amountIn).toStrictEqual(BigInt("3600441989"));
  });

  test("it properly determines tokenOut", async () => {
    const recipientCoins = [
      { symbol: "USDT", chainId: 8 },
      { symbol: "USDC", chainId: 99 },
      { symbol: "USDC", chainId: 1 },
      USDT,
    ] as TokenInfo[];
    let tokenIn = USDT;

    let [tokenOut, isSwap] = findTokenOut(tokenIn, recipientCoins);
    expect(isSwap).toBeFalsy();
    expect(tokenOut?.address).toEqual(tokenIn.address);

    tokenIn = USDZ;

    [tokenOut, isSwap] = findTokenOut(tokenIn, recipientCoins);
    expect(isSwap).toBeTruthy();
    expect(tokenOut?.symbol).toEqual("USDC");
    // use a different chainId
    tokenIn = {
      symbol: "USDT",
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      decimals: 6,
      chainId: 999,
    } as TokenInfo;
    expect(() => findTokenOut(tokenIn, recipientCoins)).toThrowError(
      "No suitable output token found"
    );
  });

  test("parse single curve quote correctly", async () => {
    const provider = await curveResponseProvider(
      [["0xd51a44d3fae010294c616388b506acda1bfaae46", BigInt(25043377206)]],
      false
    );
    const amountIn = BigInt(100000000);
    const quote = await fetchSingleCurveQuote(
      amountIn,
      "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
      "0xdac17f958d2ee523a2206206994597c13d831ec7",
      provider
    );
    expect(quote).toEqual({
      path: [
        {
          poolAddress: "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46",
          poolFee: "",
          amountIn: amountIn,
          amountOut: BigInt(25043377206),
          tokenIn: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
          tokenOut: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        },
      ],
      amountIn: amountIn,
      amountOut: BigInt(25043377206),
    });
  });

  test("throw for single curve token address doesn't exist error", async () => {
    const provider = await curveResponseProvider([["0", BigInt(0)]], false);
    await expect(() =>
      fetchSingleCurveQuote(
        BigInt(100000000),
        // Give it an "invalid" token address
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c598",
        "0xdac17f958d2ee523a2206206994597c13d831ec8",
        provider
      )
    ).rejects.toThrowError(
      "Token address doesn't exist for one of the tokens."
    );
  });

  test("throw for single curve invalid address", async () => {
    const provider = createPublicClient({
      chain: mainnet,
      transport: http("http://localhost"),
    });
    await expect(() =>
      fetchSingleCurveQuote(
        BigInt(100000000),
        // Give it an "invalid" token address
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c59",
        "0xdac17f958d2ee523a2206206994597c13d831ec8",
        provider
      )
    ).rejects.toThrowError("One of the token addresses is invalid.");
  });

  test("should throw an error if the provider does not have a chain", async () => {
    const provider = createPublicClient({
      transport: http("http://localhost"),
    });
    await expect(() =>
      fetchSingleCurveQuote(
        BigInt(100000000),
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
        "0xdac17f958d2ee523a2206206994597c13d831ec7",
        provider
      )
    ).rejects.toThrowError("Provider must have a chain.");
  });

  test("should throw an error if the chain does not exist in our chainlist", async () => {
    const provider = createPublicClient({
      chain: {
        id: 1234567,
        name: "Not a real chain",
        network: "Not a real network",
        nativeCurrency: {
          name: "Not a real token",
          symbol: "NRT",
          decimals: 18,
        },
        rpcUrls: {
          default: {
            http: ["https://localhost"],
          },
          public: {
            http: ["https://localhost"],
          },
        },
      },
      transport: http("http://localhost"),
    });
    await expect(() =>
      fetchSingleCurveQuote(
        BigInt(100000000),
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
        "0xdac17f958d2ee523a2206206994597c13d831ec7",
        provider
      )
    ).rejects.toThrowError(
      "Chain 1234567 does not have a curve router address."
    );
  });

  test("should throw an error if the chain does not have a curve router address", async () => {
    const provider = createPublicClient({
      chain: goerli,
      transport: http("http://localhost"),
    });
    await expect(() =>
      fetchSingleCurveQuote(
        BigInt(100000000),
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
        "0xdac17f958d2ee523a2206206994597c13d831ec7",
        provider
      )
    ).rejects.toThrowError("Chain 5 does not have a curve router address.");
  });

  test("correctly determine swap types", () => {
    // If the curve package gets updated and some pools get updated/removed, these might fail
    // In that case these tests should be updated - however this should be a rare enough situation
    expect(
      determineSwapParams(
        "0x9838eCcC42659FA8AA7daF2aD134b53984c9427b", // eurtusd pool
        "0xC581b735A1688071A1746c968e0798D642EDE491", // EURT (wrapped and underlying)
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        1
      )
    ).toEqual([0, 2, 4]);
    expect(
      determineSwapParams(
        "0x9838eCcC42659FA8AA7daF2aD134b53984c9427b", // eurtusd pool
        "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490", // 3Crv (wrapped coin)
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        1
      )
    ).toEqual([1, 2, 3]);
    expect(
      determineSwapParams(
        "0x9838eCcC42659FA8AA7daF2aD134b53984c9427b", // eurtusd pool
        "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        1
      )
    ).toEqual([3, 2, 4]);
    expect(
      determineSwapParams(
        "0x8301AE4fc9c624d1D396cbDAa1ed877821D7C511", // crveth pool
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH (wrapped)
        "0xD533a949740bb3306d119CC777fa900bA034cd52", // CRV (wrapped and unwrapped)
        1
      )
    ).toEqual([0, 1, 3]);
    expect(
      determineSwapParams(
        "0x8301AE4fc9c624d1D396cbDAa1ed877821D7C511", // crveth pool
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // ETH
        "0xD533a949740bb3306d119CC777fa900bA034cd52", // CRV (wrapped and unwrapped)
        1
      )
    ).toEqual([0, 1, 3]);

    // from 0x930fd1139f58121fd0f8c0c77606fb8603fbd45aa20817c08cdd5a72c5cdd847 tx
    expect(
      determineSwapParams(
        "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7", // DAI/USDC/USDT
        "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
        1
      )
    ).toEqual([2, 1, 1]);

    // from 0x41087d4635aa6b272bde9c278d6841147640779e34e987c483281e404a703420 tx
    expect(() =>
      determineSwapParams(
        "0x7f86bf177dd4f3494b841a37e810a34dd56c829b", // ETH/WBTC/USDC tricrypto
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // ETH
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
        1
      )
    ).toThrowError("Failed to find Curve pool.");

    // from 0x0772b74465ac448a5d8289bb86097a4b54e0995a014e7c0bca63983aca089afd tx
    expect(
      determineSwapParams(
        "0xd51a44d3fae010294c616388b506acda1bfaae46", // USDT/WBTC/WETH
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // ETH
        "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
        1
      )
    ).toEqual([2, 0, 3]);
  });

  test("ensure all pools present in curvejs constants have a valid type for eth chain", () => {
    const ALL_POOLS: [string, IPoolData][] = Object.entries(
      NETWORK_CONSTANTS[1].POOLS_DATA
    );
    for (const [, poolData] of ALL_POOLS) {
      const swapType = determineSwapParams(
        poolData.swap_address,
        poolData.underlying_coin_addresses[0],
        poolData.underlying_coin_addresses[1],
        1
      );
      expect(swapType[2]).toBeGreaterThan(0);
      expect(swapType[2]).toBeLessThan(5);
    }
  });

  test("should throw an error if tokens are invalid", () => {
    expect(() =>
      determineSwapParams(
        "0xd51a44d3fae010294c616388b506acda1bfaae46", // USDT/WBTC/WETH
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // WETH
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // WETH
        1
      )
    ).toThrowError("Tokens must not be equal.");

    expect(() =>
      determineSwapParams(
        "0xd51a44d3fae010294c616388b506acda1bfaae46", // USDT/WBTC/WETH
        "0x0", // invalid
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // ETH
        1
      )
    ).toThrowError("One of the token addresses is invalid.");

    expect(() =>
      determineSwapParams(
        "0xd51a44d3fae010294c616388b506acda1bfaae46", // USDT/WBTC/WETH
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // ETH
        "0x0", // invalid
        1
      )
    ).toThrowError("One of the token addresses is invalid.");

    expect(() =>
      determineSwapParams(
        "0xd51a44d3fae010294c616388b506acda1bfaae46", // USDT/WBTC/WETH
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // ETH
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC - invalid
        1
      )
    ).toThrowError("One or both of the tokens is not part of the pool.");

    expect(() =>
      determineSwapParams(
        "0xd51a44d3fae010294c616388b506acda1bfaae46", // USDT/WBTC/WETH
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC - invalid
        1
      )
    ).toThrowError("One or both of the tokens is not part of the pool.");
  });

  test("nonexistent pool should throw correctly", () => {
    expect(() =>
      determineSwapParams(
        "0x00000000000000000000000000000000000000001",
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "0xdac17f958d2ee523a2206206994597c13d831ec7",
        1
      )
    ).toThrowError("Failed to find Curve pool.");
  });
});
