import { ExchangeRate, TokensHeldState } from "@hiropay/common";
import { TokenInfo } from "@yodlpay/tokenlists";
import { erc20Abi } from "viem";
import { create } from "zustand";

type ContractToRead = {
  address: `0x${string}`;
  abi: typeof erc20Abi;
  functionName: string;
  args: `0x${string}`[];
  tokenInfo: TokenInfo;
};

const initialState = {
  exchangeRates: null,
  tokensHeld: null,
  contractsToRead: [] as ContractToRead[],
};

type TokenStoreType = {
  exchangeRates: ExchangeRate | null;
  tokensHeld: TokensHeldState | null;
  contractsToRead: ContractToRead[];
  setExchangeRates: (exchangeRate: ExchangeRate) => void;
  setTokensHeld: (tokensHeld: TokensHeldState) => void;
  setContractsToRead: (contractsToRead: ContractToRead[]) => void;
  resetTokenState: () => void;
};

export const useTokenStore = create<TokenStoreType>((set) => ({
  ...initialState,
  setExchangeRates: (exchangeRates) => set({ exchangeRates }),
  setTokensHeld: (tokensHeld) => set({ tokensHeld }),
  setContractsToRead: (contractsToRead) => set({ contractsToRead }),
  resetTokenState: () => set({ ...initialState }),
}));

export const tokenStore = useTokenStore;
