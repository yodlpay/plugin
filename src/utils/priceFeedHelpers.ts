import AggregatorV3Interface from "@chainlink/contracts/abi/v0.8/AggregatorV3Interface.json";
import {
  AddressZero,
  Currency,
  PaymentType,
  PriceFeedData,
  getTokenCurrency,
} from "@hiropay/common";
import { ChainInfo, HIRO_ROUTER_ABIS, TokenInfo } from "@yodlpay/tokenlists";
import { Address, PublicClient } from "viem";

/*
 * For a given token, we want to get price feeds that convert it into currency.
 * Currently we only have Currency/USD pairs in the price feeds list.
 *
 * DIRECT payment we want to convert from currency -> token in
 * we want to figure out how much ETH we should send
 * eg. 1900USD -> 1ETH for USD invoice
 * SWAP payment we want to convert from the token out -> currency
 * we want to figure out the minimum amount out we should swap for
 * eg. (SHIB->USDC) -> 110USD -> 100EUR for EUR invoice
 */
export function getPriceFeeds(
  chain: ChainInfo,
  currency: Currency,
  tokenInfo: TokenInfo,
  paymentType: PaymentType
): Address[] {
  if (!chain.priceFeeds) {
    throw Error(`Chain ${chain.chainId} does not have any price feeds.`);
  }

  const tokenCurrency = getTokenCurrency(tokenInfo);

  if (!tokenCurrency || currency == tokenCurrency) {
    return [];
  }

  if (currency == Currency.USD) {
    // We only need one price feed
    if (!chain.priceFeeds[tokenCurrency]) {
      throw Error(`Price feed for ${tokenCurrency} not present.`);
    }

    return [
      paymentType === PaymentType.SWAP
        ? chain.priceFeeds[tokenCurrency]
        : AddressZero,
      paymentType === PaymentType.DIRECT
        ? chain.priceFeeds[tokenCurrency]
        : AddressZero,
    ] as Address[];
  } else {
    if (tokenCurrency == Currency.USD) {
      if (!chain.priceFeeds[currency]) {
        throw Error(`Price feed for ${currency} not present.`);
      }

      return [
        paymentType === PaymentType.DIRECT
          ? chain.priceFeeds[currency]
          : AddressZero,
        paymentType === PaymentType.SWAP
          ? chain.priceFeeds[currency]
          : AddressZero,
      ] as Address[];
    }
    // We need to convert from token -> USD -> currency
    if (!chain.priceFeeds[tokenCurrency] || !chain.priceFeeds[currency]) {
      throw Error(
        `Price feeds not present for ${tokenCurrency} and ${currency}.`
      );
    }
    if (paymentType === PaymentType.DIRECT) {
      return [
        chain.priceFeeds[currency],
        chain.priceFeeds[tokenCurrency],
      ] as Address[];
    } else if (paymentType === PaymentType.SWAP) {
      return [
        chain.priceFeeds[tokenCurrency],
        chain.priceFeeds[currency],
      ] as Address[];
    } else {
      throw Error(`Unhandled payment type ${paymentType}.`);
    }
  }
}

export async function getPriceFeedDetails(
  provider: PublicClient,
  priceFeeds: Record<string, Address>
) {
  const feedAddresses = Object.values(priceFeeds);
  const feedAddressToSymbol = Object.fromEntries(
    Object.entries(priceFeeds).map(([key, value]) => [value, key])
  );
  const results = await provider.multicall({
    contracts: feedAddresses.flatMap((feedAddress) => [
      {
        address: feedAddress,
        abi: AggregatorV3Interface as any,
        functionName: "latestRoundData",
        args: [],
      },
      {
        address: feedAddress,
        abi: AggregatorV3Interface as any,
        functionName: "decimals",
        args: [],
      },
      {
        address: feedAddress,
        abi: AggregatorV3Interface as any,
        functionName: "description",
        args: [],
      },
    ]),
  });
  const priceFeedData = results
    .filter((result) => !!result.result)
    .reduce((priceFeedData, result, i) => {
      // Figure out the price feed address
      const priceFeedAddress = feedAddresses[Math.floor(i / 3)];
      const priceFeedSymbol = feedAddressToSymbol[priceFeedAddress];
      if (!(priceFeedSymbol in priceFeedData)) {
        priceFeedData[priceFeedSymbol] = {
          rate: undefined,
          decimals: undefined,
          description: undefined,
        };
      }

      const dataType = i % 3;
      if (dataType === 0) {
        const [, exchangeRate] = result.result as bigint[];
        priceFeedData[priceFeedSymbol].rate = exchangeRate;
      } else if (dataType === 1) {
        priceFeedData[priceFeedSymbol].decimals =
          result.result as unknown as number;
      } else if (dataType === 2) {
        priceFeedData[priceFeedSymbol].description =
          result.result as unknown as string;
      }
      return priceFeedData;
    }, {} as any);

  // Remove price feeds with missing data
  for (const key of Object.keys(priceFeedData)) {
    if (
      key in priceFeedData &&
      (!priceFeedData[key].rate ||
        !priceFeedData[key].decimals ||
        !priceFeedData[key].description)
    ) {
      delete priceFeedData[key];
    }
  }
  return priceFeedData as Record<string, PriceFeedData>;
}

export async function getExchangeRate(
  client: PublicClient | undefined,
  routerAddress: Address,
  routerVersion: string,
  priceFeeds: Address[],
  amount: bigint
) {
  if (routerVersion === "0.1") {
    // Check for invalid price feeds
    if (priceFeeds[1] != AddressZero) {
      throw Error(
        "Router V0.1 does not support inverse or multiple price feeds."
      );
    }

    // Convert to V0.1 accepted format - from [address, 0x0] to [address]
    priceFeeds.pop();
  }
  const routerAbi = getRouterAbi(routerVersion);
  return (await client?.readContract({
    address: routerAddress,
    abi: routerAbi,
    functionName: "exchangeRate",
    args: [priceFeeds, amount],
  })) as [bigint, Address[], bigint[]];
}

export function getRouterAbi(version: string) {
  return HIRO_ROUTER_ABIS[version];
}
