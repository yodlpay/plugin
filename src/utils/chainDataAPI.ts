import {
  CurveBestRouteAndOutput,
  IChainDataAPI,
  PricesResponse,
  Quote,
  TokenBalance,
} from "@hiropay/common";
import { Address } from "viem";
import { mainStore } from "../contexts/useMainStore";
import { uniswapResponseToQuote } from "../utils/helpers";

export class ChainDataAPI implements IChainDataAPI {
  url: string;
  walletAddress: string | undefined;

  constructor(url: string) {
    this.url = url;
  }

  setWalletAddress(address: string) {
    this.walletAddress = address;
  }

  async isConnected(): Promise<boolean> {
    const mainStoreState = mainStore.getState();
    const url = `${this.url}/healthcheck`;
    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        mainStoreState.logger?.error(
          `Failed to call '/health' with status ${res.status} - ${res.statusText}`
        );
        return false;
      }

      const resJson = (await res.json()) as { success: boolean };
      return resJson.success;
    } catch (err) {
      mainStoreState.logger?.error(
        `Failed to call '/health' with error ${err}`
      );
      return false;
    }
  }

  async getExchangeRates(
    tokensIn: string[],
    currencies: string[]
  ): Promise<PricesResponse> {
    const searchParams = new URLSearchParams({
      ids: tokensIn.join(","),
      currencies: currencies.join(","),
    });
    const url = `${this.url}/prices?${searchParams.toString()}`;
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        walletAddress: this.walletAddress,
      } as HeadersInit,
      method: "GET",
    });

    if (!res.ok) {
      throw new Error(
        `Failed to call '/prices' with status ${res.status} - ${res.statusText}`
      );
    }

    return (await res.json()) as PricesResponse;
  }

  async getTokenBalances(
    chainId: number,
    address: Address
  ): Promise<TokenBalance[]> {
    const searchParams = new URLSearchParams({
      chainId: chainId.toString(),
      address,
    });
    const url = `${this.url}/tokens?${searchParams.toString()}`;
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        walletAddress: this.walletAddress,
      } as HeadersInit,
      method: "GET",
    });

    if (!res.ok) {
      throw new Error(
        `Failed to call '/tokens' with status ${res.status} - ${res.statusText}`
      );
    }

    return (await res.json()) as TokenBalance[];
  }

  async getUniswapQuote(
    tokenInAddress: Address,
    tokenOutAddress: Address,
    amount: bigint,
    chainId: number | undefined
  ): Promise<Quote> {
    const searchParams = new URLSearchParams({
      tokenInAddress,
      tokenOutAddress,
      amount: amount.toString(),
      chainId: chainId?.toString() ?? "",
    });
    const url = `${this.url}/uniswap?${searchParams.toString()}`;
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        walletAddress: this.walletAddress,
      } as HeadersInit,
      method: "GET",
    });

    if (!res.ok) {
      throw new Error(
        `Failed to call '/uniswap' with status ${res.status} - ${res.statusText}`
      );
    }

    return uniswapResponseToQuote(await res.json());
  }

  async getCurveQuote(
    tokenInAddress: Address,
    tokenOutAddress: Address,
    amount: number | string,
    chainId: number | undefined
  ): Promise<CurveBestRouteAndOutput> {
    const searchParams = new URLSearchParams({
      tokenInAddress,
      tokenOutAddress,
      amount: amount.toString(),
      chainId: chainId?.toString() ?? "",
    });
    const url = `${this.url}/curve?${searchParams.toString()}`;
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        walletAddress: this.walletAddress,
      } as HeadersInit,
      method: "GET",
    });

    if (!res.ok) {
      throw new Error(
        `Failed to call '/curve' with status ${res.status} - ${res.statusText}`
      );
    }

    return (await res.json()) as CurveBestRouteAndOutput;
  }

  async getChainsWithBalance(address: Address): Promise<number[]> {
    const searchParams = new URLSearchParams({
      address,
    });
    const url = `${this.url}/chains?${searchParams.toString()}`;
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        walletAddress: this.walletAddress,
      } as HeadersInit,
      method: "GET",
    });

    if (!res.ok) {
      throw new Error(
        `Failed to call '/chains' with status ${res.status} - ${res.statusText}`
      );
    }

    return (await res.json()) as number[];
  }
}
