import {
  CurveBestRouteAndOutput,
  IChainDataAPI,
  LOCAL_RPC_URL,
  PricesResponse,
  Quote,
  SUPPORTED_CHAINS,
  TokenBalance,
  getNativeTokenBalance,
  getTokenBalances,
  getViemChain,
  tokenAddressToToken,
} from "@hiropay/common";
import { getTokens } from "@yodlpay/tokenlists";
import { Address, createPublicClient, http } from "viem";
import { getPrices } from "../utils/coingecko";
import { fetchUniswapQuote } from "../utils/helpers";

export class BrowserChainDataAPI implements IChainDataAPI {
  curveClient: any; // types don't work well for curve imports
  testnetMode: boolean = false;
  walletAddress: string | undefined;

  setWalletAddress(address: string) {
    this.walletAddress = address;
  }

  setTestnetMode(testnetMode: boolean) {
    this.testnetMode = testnetMode;
  }

  setCurveClient(curveClient: any) {
    this.curveClient = curveClient;
  }

  async getExchangeRates(
    tokensIn: string[],
    currencies: string[]
  ): Promise<PricesResponse> {
    return await getPrices(tokensIn, currencies);
  }

  async getUniswapQuote(
    tokenInAddress: Address,
    tokenOutAddress: Address,
    amount: bigint,
    chainId: number
  ): Promise<Quote | undefined> {
    if (this.testnetMode) {
      return undefined;
    } else {
      return await fetchUniswapQuote(
        amount,
        tokenInAddress,
        tokenOutAddress,
        chainId
      );
    }
  }

  async getCurveQuote(
    tokenInAddress: Address,
    tokenOutAddress: Address,
    amount: number | string,
    chainId: number
  ): Promise<CurveBestRouteAndOutput> {
    // The curveClient will have no provider if it hasn't been initialized
    if (!this.curveClient || this.curveClient.chainId === 0) {
      throw Error("Curve client has not been initialized.");
    }

    if (this.curveClient.chainId != chainId) {
      throw Error("Curve client has a mismatched chain id.");
    }

    const swapRoute = (await this.curveClient.router.getBestRouteAndOutput(
      tokenInAddress,
      tokenOutAddress,
      amount
    )) as CurveBestRouteAndOutput;
    const priceImpact = (await this.curveClient.router.priceImpact(
      tokenInAddress,
      tokenOutAddress,
      amount
    )) as number;

    return { ...swapRoute, priceImpact };
  }

  async getTokenBalances(
    chainId: number,
    address: string
  ): Promise<TokenBalance[]> {
    const client = createPublicClient({
      chain: getViemChain(chainId),
      transport: this.testnetMode ? http(LOCAL_RPC_URL) : http(),
    });
    const [tokenBalances, nativeTokenBalance] = await Promise.all([
      getTokenBalances(client as any, address as Address, getTokens(chainId)),
      getNativeTokenBalance(client as any, address as Address),
    ]);
    return tokenBalances.concat([nativeTokenBalance]).map((token) => {
      const tokenInfo = tokenAddressToToken(token.address as string, chainId);
      return {
        ...token,
        logoUri: !!tokenInfo ? tokenInfo.logoUri : undefined,
      };
    });
  }

  async getChainsWithBalance(_address: Address): Promise<number[]> {
    // We need the Ankr API to fetch balances across chains - since we don't have this, return all supported chains.
    return SUPPORTED_CHAINS.map((chain) => chain.chainId);
  }
}
