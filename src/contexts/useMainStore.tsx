import {
  AddressZero,
  ChainsWithBalanceState,
  EnvData,
  IChainDataAPI,
  SUPPORTED_CHAINS,
  THEME_COLOR_SCHEME,
  TokenHeld,
  TransactionState,
} from '@hiropay/common'
import { ColorScheme } from '@mantine/core'
import { Address } from 'viem'
import { Config } from 'wagmi'
import { create } from 'zustand'
import { BrowserChainDataAPI } from '../utils/browserChainDataAPI'
import {
  Analytics,
  CallbackAction,
  CallbackCategory,
  CallbackPage,
  Logger,
} from '../wrappers/Provider'
import { useInvoiceStore } from './useInvoiceStore'
import { usePaymentStore } from './usePaymentStore'

const initialState = {
  wagmiConfig: null,
  token: null,
  transaction: null,
  chainLoading: false,
  chainSelected: false,
  chainsWithBalance: {
    data: SUPPORTED_CHAINS.map((chain) => chain.chainId),
    loading: false,
    error: null,
  },
  curveLoading: false,
  routerVersion: '0.1',
  routerAddress: AddressZero,
  colorScheme: THEME_COLOR_SCHEME as ColorScheme,
  skippedWelcome: true,
  // uncomment to enable skippedWelcome:
  // skippedWelcome:
  // typeof localStorage !== "undefined"
  //   ? !!localStorage.getItem(WELCOME_DISPLAYED)
  //   : false,
  flowInitiated: false,
  chainDataAPI: new BrowserChainDataAPI(),
  isDemo: false,
  isTest: false,
  testnetMode: false,
  rpcUrl: '',
  dataApiUrl: '',
  logger: null,
  analytics: null,
  eventCallback: () => {},
  pageCallback: () => {},
}

type MainStoreType = {
  wagmiConfig: Config | null
  token: TokenHeld | null
  transaction: TransactionState | null
  chainLoading: boolean
  chainSelected: boolean
  chainsWithBalance: ChainsWithBalanceState | null
  curveLoading: boolean
  routerVersion: string
  routerAddress: Address
  colorScheme: ColorScheme
  skippedWelcome: boolean
  flowInitiated: boolean
  chainDataAPI: IChainDataAPI
  isDemo: boolean
  isTest: boolean
  testnetMode: boolean
  rpcUrl: string
  dataApiUrl: string
  logger: Logger | null
  analytics: Analytics | null
  setLogger: (logger: Logger) => void
  setAnalytics: (analytics: Analytics) => void
  eventCallback: (
    action: CallbackAction,
    params?: Record<string, unknown>,
  ) => void
  pageCallback: (
    category: CallbackCategory,
    page: CallbackPage,
    params?: Record<string, unknown>,
  ) => void
  setWagmiConfig: (wagmiConfig: Config) => void
  setEnv: (envData: EnvData) => void
  setToken: (token: TokenHeld | null) => void
  setTransaction: (transaction: TransactionState) => void
  setTransactionConfirmed: (confirmed: boolean) => void
  setChainLoading: (loading: boolean) => void
  setChainSelected: (selected: boolean) => void
  setChainsWithBalance: (chainsWithBalance: ChainsWithBalanceState) => void
  setCurveLoading: (loading: boolean) => void
  setRouterVersion: (version: string) => void
  setRouterAddress: (address: Address) => void
  setSkippedWelcome: (skipped: boolean) => void
  setColorScheme: (scheme: 'dark' | 'light') => void
  setFlowInitiated: (open: boolean) => void
  setChainDataAPI: (chainDataAPI: IChainDataAPI) => void
  setEventCallback: (
    eventCallback: (
      action: CallbackAction,
      params?: Record<string, unknown>,
    ) => void,
  ) => void
  setPageCallback: (
    pageCallback: (
      category: CallbackCategory,
      page: CallbackPage,
      params?: Record<string, unknown>,
    ) => void,
  ) => void
  setCloseModal: () => void
  resetTransaction: () => void
  resetMainState: () => void
}

export const useMainStore = create<MainStoreType>((set) => ({
  ...initialState,
  setLogger: (logger) => set({ logger }),
  setAnalytics: (analytics) => set({ analytics }),
  setWagmiConfig: (wagmiConfig: Config) => set({ wagmiConfig }),
  setEnv: (envData) => set({ ...envData }),
  setToken: (token) => set({ token }),
  setTransaction: (transaction) => set({ transaction }),
  setTransactionConfirmed: (confirmed) =>
    set((prevState) => ({
      ...prevState,
      transaction: prevState?.transaction
        ? {
            ...prevState.transaction,
            data: prevState?.transaction?.data
              ? {
                  ...prevState?.transaction?.data,
                  confirmed,
                }
              : null,
          }
        : null,
    })),
  setChainLoading: (loading) => set({ chainLoading: loading }),
  setChainSelected: (selected) => set({ chainSelected: selected }),
  setChainsWithBalance: (chainsWithBalance) => set({ chainsWithBalance }),
  setCurveLoading: (loading) => set({ curveLoading: loading }),
  setRouterVersion: (version) => set({ routerVersion: version }),
  setRouterAddress: (address) => set({ routerAddress: address }),
  setSkippedWelcome: (skipped) => set({ skippedWelcome: skipped }),
  setColorScheme: (scheme: ColorScheme) => set({ colorScheme: scheme }),
  setFlowInitiated: (open) => set({ flowInitiated: open }),
  setChainDataAPI: (chainDataAPI) => set({ chainDataAPI }),
  setEventCallback: (eventCallback) => set({ eventCallback }),
  setPageCallback: (pageCallback) => set({ pageCallback }),
  setCloseModal: () => {
    set({ flowInitiated: false })
    useInvoiceStore.getState().resetInvoiceState()
    useMainStore.getState().resetMainState()
    usePaymentStore.getState().dispatch({ type: 'RESET_PAYMENT_STATE' })
  },
  resetTransaction: () => set({ transaction: null }),
  resetMainState: () => set({ ...initialState }),
}))

export const mainStore = useMainStore
