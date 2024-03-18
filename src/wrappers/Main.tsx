//@ts-check
import { curve } from '@curvefi/api'
import { CoinConfig, LOCAL_RPC_URL } from '@hiropay/common'
import { createStyles } from '@mantine/core'
import { ChainInfo, getChain, getLatestRouter } from '@yodlpay/tokenlists'
import { enqueueSnackbar } from 'notistack'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Address, Chain, createPublicClient, http } from 'viem'
import { useAccount, useConnect, usePublicClient } from 'wagmi'
import { Header } from '../components/layout/Header'
import {
  ROUTER_ADDRESS_LS_KEY,
  ROUTER_VERSION_LS_KEY,
  WELCOME_DISPLAYED,
} from '../constants/test'
import { useInvoiceStore } from '../contexts/useInvoiceStore'
import { useMainStore } from '../contexts/useMainStore'
import { usePaymentStore } from '../contexts/usePaymentStore'
import ChainDialog from '../dialogs/ChainDialog'
import PaymentDialog from '../dialogs/PaymentDialog'
import StatusDialog from '../dialogs/StatusDialog'
import TokenDialog from '../dialogs/TokenDialog'
import WalletDialog from '../dialogs/WalletDialog'
import WelcomeDialog from '../dialogs/WelcomeDialog'
import { useChainsWithBalance, usePayment, useViewBasedState } from '../hooks'
import { actions } from '../reducers/payment'
import { BrowserChainDataAPI } from '../utils/browserChainDataAPI'
import { ChainDataAPI } from '../utils/chainDataAPI'
import { formatWagmiError, getRouterAddress } from '../utils/helpers'
import { ScrollShadowWrapper } from './Scroll'

const useStyles = createStyles(() => ({
  container: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'fadeAndScaleIn 0.4s forwards',
  },
}))

export type MainWrapperProps = {
  customChildren?: boolean
  children?: JSX.Element
}

export const MainWrapper = ({
  customChildren = false,
  children,
}: MainWrapperProps) => {
  const { isPending } = useConnect()
  const { chain: accountChain, connector, address, isConnected } = useAccount()
  const client = usePublicClient()
  const { invoice } = usePayment()
  useChainsWithBalance()

  const token = useMainStore((state) => state.token)
  const transaction = useMainStore((state) => state.transaction)
  const chainSelected = useMainStore((state) => state.chainSelected)
  const skippedWelcome = useMainStore((state) => state.skippedWelcome)
  const browserChainDataAPI = useMainStore((state) => state.chainDataAPI)
  const testnetMode = useMainStore((state) => state.testnetMode)
  const isTest = useMainStore((state) => state.isTest)
  const dataApiUrl = useMainStore((state) => state.dataApiUrl)

  const setToken = useMainStore((state) => state.setToken)
  const setChainLoading = useMainStore((state) => state.setChainLoading)
  const setChainSelected = useMainStore((state) => state.setChainSelected)
  const setCurveLoading = useMainStore((state) => state.setCurveLoading)
  const setRouterVersion = useMainStore((state) => state.setRouterVersion)
  const setRouterAddress = useMainStore((state) => state.setRouterAddress)
  const setSkippedWelcome = useMainStore((state) => state.setSkippedWelcome)
  const setChainDataAPI = useMainStore((state) => state.setChainDataAPI)

  const setInvoice = useInvoiceStore((state) => state.setInvoice)

  const dispatch = usePaymentStore((state) => state.dispatch)

  const [stateKey, setStateKey] = useState(0)

  const { classes } = useStyles()

  const currentChainId = accountChain?.id

  const chainIds = invoice.coins.map(
    (coinConfig: CoinConfig) => coinConfig.chainId,
  )

  const handleContinue = useCallback(() => {
    localStorage.setItem(WELCOME_DISPLAYED, 'true')
    setSkippedWelcome(true)
  }, [setSkippedWelcome])

  const chain: ChainInfo | null = useMemo(() => {
    if (
      chainSelected &&
      currentChainId !== undefined &&
      chainIds.includes(currentChainId)
    ) {
      return getChain(currentChainId)
    } else {
      return null
    }
  }, [chainIds, chainSelected, currentChainId])

  const resetSelectedToken = useCallback(() => {
    // logger.info("resetSelectedToken");
    setToken(null)
  }, [setToken])

  const resetSelectedChain = useCallback(() => {
    // logger.info("resetSelectedChain");
    setChainSelected(false)
    setToken(null)
  }, [setChainSelected, setToken])

  const handleRetry = useCallback(() => {
    dispatch({ type: actions.RESET_PAYMENT_STATE })
    setStateKey((prevState) => prevState + 1)
  }, [dispatch])

  const selectChain = useCallback(
    async (chainId: number | undefined) => {
      // logger.info(`selectChain: ${chainId}`);
      if (connector) {
        setChainLoading(true)
        try {
          await connector.connect?.({ chainId })
          setChainSelected(true)
          // logger.info("selectedConnector.current.connect.then");
        } catch (err) {
          // logger.info(`selectedConnector.current.connect.catch: ${err}`);
          enqueueSnackbar(formatWagmiError(err), { variant: 'error' })
        } finally {
          resetSelectedToken()
          setChainLoading(false)
        }
      } else {
        // WalletConnect first calls selectChain, then assigns selectedConnector.current
        // logger.info("selectedConnector.current does not exist");
      }
    },
    [connector, resetSelectedToken, setChainLoading, setChainSelected],
  )

  const renderDialogContent = useCallback(() => {
    if (!skippedWelcome) {
      return <WelcomeDialog onContinue={handleContinue} />
    }
    if (!isConnected || isPending) {
      return <WalletDialog />
    }
    if (transaction) {
      return <StatusDialog />
    }
    if (chain == null && token == null) {
      return <ChainDialog selectChain={selectChain} />
    }
    if (chain != null && token == null) {
      return <TokenDialog />
    }
    if (chain && token) {
      return <PaymentDialog handleRetry={handleRetry} />
    }

    return null
  }, [
    skippedWelcome,
    isConnected,
    isPending,
    transaction,
    chain,
    token,
    handleContinue,
    selectChain,
    handleRetry,
  ])

  const renderedContent = renderDialogContent()

  const { key } = useViewBasedState(renderedContent)

  const headerFooterProps = useMemo(
    () => ({
      view: renderedContent,
      resetChain: resetSelectedChain,
      resetToken: resetSelectedToken,
      selectChain: selectChain,
    }),
    [renderedContent, resetSelectedChain, resetSelectedToken, selectChain],
  )

  const selectChainDataAPI = useCallback(async () => {
    try {
      if (!browserChainDataAPI.hasOwnProperty('url')) {
        // Check if the ChainDataAPI url is up
        const chainDataAPI = new ChainDataAPI(dataApiUrl)
        const isChainDataAPIUp = await chainDataAPI.isConnected()
        if (isChainDataAPIUp) {
          setChainDataAPI(chainDataAPI)
        } else {
          // Otherwise set the curveClient in the default BrowserChainDataAPI
          // logger.info("Chain data API is not up, will use browser...");
          ;(browserChainDataAPI as BrowserChainDataAPI).setTestnetMode(
            testnetMode,
          )
          ;(browserChainDataAPI as BrowserChainDataAPI).setCurveClient(curve)
        }
      }
    } catch (err) {
      // logger.error("Failed to set chain data API");
      // logger.error(err);
    }
  }, [dataApiUrl, testnetMode, browserChainDataAPI, setChainDataAPI])

  // useSwitchNetwork({
  //   throwForSwitchChainNotSupported: true,
  // });

  useEffect(() => {
    const initCurve = async () => {
      if (chain?.chainId && accountChain?.id) {
        // If we have already initialized curve for the current chain id, don't do it again
        if (curve.chainId != chain.chainId) {
          setCurveLoading(true)
          try {
            // initialize curve
            if (testnetMode) {
              // create a client
              const testnetClient = createPublicClient({
                chain: accountChain as Chain,
                transport: http(LOCAL_RPC_URL),
              })
              await curve.init(
                'Web3',
                { externalProvider: testnetClient },
                { chainId: chain.chainId },
              )
            } else {
              if (client) {
                if (client.transport.transports.length > 0) {
                  const url = client?.transport.transports[0].value.url
                  await curve.init(
                    'JsonRpc',
                    { url },
                    { chainId: chain.chainId },
                  )
                } else {
                  await curve.init(
                    'Web3',
                    { externalProvider: client },
                    { chainId: chain.chainId },
                  )
                }
              }
            }

            const factories = [
              curve.factory,
              curve.crvUSDFactory,
              curve.EYWAFactory,
              curve.cryptoFactory,
              curve.tricryptoFactory,
            ]

            await Promise.all(factories.map((factory) => factory.fetchPools()))
          } catch (err) {
            // logger.error(`Failed to initialize curvejs with error: ${err}`);
          }

          setCurveLoading(false)
        }
      }
    }
    initCurve()
  }, [testnetMode, chain?.chainId, client, accountChain, setCurveLoading])

  useEffect(() => {
    if (chainSelected && !!chain) {
      // Handle explicit router version from tests
      const testRouterVersion = localStorage.getItem(ROUTER_VERSION_LS_KEY)
      const testRouterAddress = localStorage.getItem(ROUTER_ADDRESS_LS_KEY)
      if (isTest) {
        if (!!testRouterVersion) {
          setRouterVersion(testRouterVersion)
        }
        if (!!testRouterAddress) {
          setRouterAddress(testRouterAddress as Address)
        }
      }

      if (testnetMode) {
        // Set these only if we haven't explicitly set them in localstorage
        if (!testRouterVersion) {
          setRouterVersion('test')
        }
        if (!testRouterAddress) {
          setRouterAddress(
            getRouterAddress(chain.chainId, 'test') as `0x${string}`,
          )
        }
      } else {
        const latestRouter = getLatestRouter(chain.chainId)
        setRouterVersion(latestRouter.version)
        setRouterAddress(latestRouter.address as Address)
      }
    }
  }, [
    isTest,
    testnetMode,
    chain,
    chainSelected,
    setRouterVersion,
    setRouterAddress,
  ])

  useEffect(() => {
    selectChainDataAPI()
  }, [selectChainDataAPI])

  useEffect(() => {
    if (invoice.isDemo && address && invoice.recipientAddress !== address) {
      setInvoice({ ...invoice, recipientAddress: address })
    }
  }, [address, invoice, setInvoice])

  useEffect(() => {
    if (!!address) {
      // For requests to the data API we want to let it know which address is making the request
      browserChainDataAPI.setWalletAddress(address)
    }
  }, [address, browserChainDataAPI])

  return customChildren ? (
    children
  ) : renderedContent ? (
    <>
      <Header {...headerFooterProps} />
      <div className={classes.container} key={key}>
        <ScrollShadowWrapper key={stateKey}>
          {renderedContent}
        </ScrollShadowWrapper>
      </div>
    </>
  ) : null
}
