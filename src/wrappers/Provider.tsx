import {
  InvoiceConfig,
  LOCAL_RPC_URL,
  PickEnum,
  RudderStackJSEvents,
  RudderStackJSPageCategories,
  RudderStackJSPageNames,
  SwapVenue,
  generateWagmiConfig,
  getUniqueChainsForTokens,
} from "@hiropay/common";
import { ColorScheme } from "@mantine/core";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, createContext, useCallback, useContext } from "react";
import { Config as WagmiConfig, WagmiProvider } from "wagmi";
import { WAGMI_STORE } from "../constants/localStorage";
import { invoiceStore } from "../contexts/useInvoiceStore";
import { mainStore, useMainStore } from "../contexts/useMainStore";
import { YodlSDKModal } from "./Modal";

const queryClient = new QueryClient();

const DEFAULT_CONFIG = {
  config: null,
  isDemo: false,
  isTest: false,
  testnetMode: false,
  dataApiUrl: "http://localhost:3003",
  rpcUrl: LOCAL_RPC_URL,
  excludedVenues: [],
  eventCallback: () => {},
  pageCallback: () => {},
  theme: "light",
};

const SDKContext = createContext({
  openModal: (_: OpenArgs) => {},
  closeModal: () => {},
});

export const useYodlSDK = () => useContext(SDKContext);

export type YodlSDKProviderProps = {
  children?: ReactNode;
};

export type CallbackPage = PickEnum<
  RudderStackJSPageNames,
  | RudderStackJSPageNames.WelcomeDialog
  | RudderStackJSPageNames.WalletDialog
  | RudderStackJSPageNames.NetworkDialog
  | RudderStackJSPageNames.TokenDialog
  | RudderStackJSPageNames.PaymentDialog
  | RudderStackJSPageNames.SuccessDialog
  | RudderStackJSPageNames.PendingDialog
  | RudderStackJSPageNames.ErrorDialog
>;

export type CallbackCategory = PickEnum<
  RudderStackJSPageCategories,
  RudderStackJSPageCategories.Payment
>;

export type CallbackAction = PickEnum<
  RudderStackJSEvents,
  | RudderStackJSEvents.WelcomeDialogSkipped
  | RudderStackJSEvents.WalletConnected
  | RudderStackJSEvents.NetworkChosen
  | RudderStackJSEvents.TokenChosen
  | RudderStackJSEvents.ApproveClicked
  | RudderStackJSEvents.ApproveRejected
  | RudderStackJSEvents.PayClicked
  | RudderStackJSEvents.PayRejected
  | RudderStackJSEvents.BackButtonClicked
  | RudderStackJSEvents.NetworkChanged
  | RudderStackJSEvents.WalletDisconnected
>;

export type EventCallback = {
  action: CallbackAction;
  params: Record<string, unknown>;
};

export type Logger = {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  http: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

export type Analytics = {
  load: (...args: unknown[]) => void;
  page: (...args: unknown[]) => void;
  track: (...args: unknown[]) => void;
  identify: (...args: unknown[]) => void;
  alias: (...args: unknown[]) => void;
  group: (...args: unknown[]) => void;
  ready: (...args: unknown[]) => void;
  reset: (...args: unknown[]) => void;
  getAnonymousId: (...args: unknown[]) => void;
  setAnonymousId: (...args: unknown[]) => void;
};

export type OpenArgs = {
  config: InvoiceConfig | null;
  isDemo?: boolean;
  isTest?: boolean;
  testnetMode?: boolean;
  dataApiUrl?: string;
  rpcUrl?: string;
  localStorage?: Storage;
  excludedVenues?: SwapVenue[];
  eventCallback?: (
    action: CallbackAction,
    params?: Record<string, unknown>
  ) => void;
  pageCallback?: (
    category: CallbackCategory,
    page: CallbackPage,
    params?: Record<string, unknown>
  ) => void;
  theme?: ColorScheme;
  logger?: Logger;
  analytics?: Analytics;
};

export const YodlSDKProvider = ({ children }: YodlSDKProviderProps) => {
  const wagmiConfig = useMainStore((state) => state.wagmiConfig);
  const setFlowInitiated = useMainStore((state) => state.setFlowInitiated);

  const openModal = useCallback(
    ({
      config = DEFAULT_CONFIG.config,
      isDemo = DEFAULT_CONFIG.isDemo,
      isTest = DEFAULT_CONFIG.isTest,
      testnetMode = DEFAULT_CONFIG.testnetMode,
      dataApiUrl = DEFAULT_CONFIG.dataApiUrl,
      rpcUrl = DEFAULT_CONFIG.rpcUrl,
      excludedVenues = DEFAULT_CONFIG.excludedVenues,
      eventCallback = DEFAULT_CONFIG.eventCallback,
      pageCallback = DEFAULT_CONFIG.pageCallback,
      theme = DEFAULT_CONFIG.theme as ColorScheme,
      logger,
      analytics,
    }: OpenArgs) => {
      if (config) {
        const invoiceStoreState = invoiceStore.getState();
        const mainStoreState = mainStore.getState();

        const invoice = {
          ...config,
          excludedVenues,
          isDemo,
        };

        invoiceStoreState.setInvoice(invoice);
        mainStoreState.setEventCallback(eventCallback);
        mainStoreState.setPageCallback(pageCallback);
        mainStoreState.setEnv({
          isDemo,
          isTest,
          testnetMode,
          rpcUrl,
          dataApiUrl,
        });
        if (!mainStoreState.logger && logger) mainStoreState.setLogger(logger);
        if (!mainStoreState.analytics && analytics)
          mainStoreState.setAnalytics(analytics);

        // Fixes the bug where disconnecting the wallet doesn't do anything
        localStorage.removeItem(WAGMI_STORE);

        const wagmiConfig = generateWagmiConfig({
          isTest,
          testnetMode,
          rpcUrl,
          theme,
          supportedChains: getUniqueChainsForTokens(config.coins),
        });

        mainStoreState.setWagmiConfig(wagmiConfig);

        setFlowInitiated(true);
      }
    },
    [setFlowInitiated]
  );

  const closeModal = useCallback(() => {
    setFlowInitiated(false);
  }, [setFlowInitiated]);

  return (
    <SDKContext.Provider value={{ openModal, closeModal }}>
      {wagmiConfig ? (
        <WagmiProvider
          config={wagmiConfig as WagmiConfig}
          reconnectOnMount={false}
        >
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              {children}
              <YodlSDKModal onClose={closeModal} />
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      ) : (
        children
      )}
    </SDKContext.Provider>
  );
};
