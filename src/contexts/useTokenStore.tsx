import { ExchangeRate, TokensHeldState } from '@hiropay/common';
import { TokenInfo } from '@yodlpay/tokenlists';
import { erc20Abi } from 'viem';
import { create } from 'zustand';

type ContractToRead = {
  address: `0x${string}`;
  abi: typeof erc20Abi;
  functionName: string;
  args: `0x${string}`[];
  tokenInfo: TokenInfo;
};

const initialState = {
  tokenStateKey: 0,
  exchangeRates: null,
  tokensHeld: null,
  contractsToRead: [] as ContractToRead[],
};

type TokenStoreType = {
  tokenStateKey: number;
  exchangeRates: ExchangeRate | null;
  tokensHeld: TokensHeldState | null;
  contractsToRead: ContractToRead[];
  setTokenStateKey: () => void;
  setExchangeRates: (exchangeRate: ExchangeRate) => void;
  setTokensHeld: (tokensHeld: TokensHeldState) => void;
  setContractsToRead: (contractsToRead: ContractToRead[]) => void;
  resetTokenState: () => void;
};

export const useTokenStore = create<TokenStoreType>((set) => ({
  ...initialState,
  setTokenStateKey: () =>
    set((prevState) => ({
      ...prevState,
      tokenStateKey: prevState.tokenStateKey + 1,
    })),
  setExchangeRates: (exchangeRates) => set({ exchangeRates }),
  setTokensHeld: (tokensHeld) => set({ tokensHeld }),
  setContractsToRead: (contractsToRead) => set({ contractsToRead }),
  resetTokenState: () => set({ ...initialState }),
}));

export const tokenStore = useTokenStore;
