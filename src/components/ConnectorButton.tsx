import { ChevronRightIcon, NoSymbolIcon } from '@heroicons/react/20/solid'
import { NavLink, connectorWalletIcon, useNavLinkStyles } from '@hiropay/common'
import { useEffect, useMemo, useState } from 'react'
import { Connector } from 'wagmi'

export type StrippedConnector = {
  id: string
  name: string
}

export const ConnectorButton = ({
  connector,
  handleClick,
}: {
  connector: Connector | StrippedConnector
  handleClick: (
    connector: Connector | StrippedConnector,
    callback: ({
      isLoading,
      error,
    }: {
      isLoading?: boolean
      error?: string | null
    }) => void,
  ) => void
}) => {
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | boolean | null>(false)

  const { classes } = useNavLinkStyles()

  const updateConnectorState = ({
    isLoading,
    error,
  }: {
    isLoading?: boolean
    error?: string | null
  }) => {
    if (typeof isLoading === 'boolean') {
      setLoading(isLoading)
    }
    if (typeof error === 'string' || error === null) {
      setError(error)
    }
  }

  const connectorState = useMemo(() => {
    if (error) {
      return { label: ' (Failed)', state: 'error' }
    }

    if (loading) {
      return { label: ' (Connecting)', state: 'connecting' }
    }

    if (!ready || (!window.ethereum && connector.id == 'metaMask')) {
      return { label: ' (Not installed)', state: 'disabled' }
    }
  }, [ready, loading, error, connector.id])

  useEffect(() => {
    setReady(true)
  }, [connector, setReady])

  return (
    <NavLink
      key={connector.name}
      size="lg"
      label={connector.name}
      description={connectorState?.label ?? ''}
      disabled={
        connectorState?.state === 'disabled' ||
        connectorState?.state === 'connecting'
      }
      icon={
        <img
          src={connectorWalletIcon(connector)}
          alt={connector.name}
          width="32px"
        />
      }
      rightIcon={
        connectorState?.state === 'disabled' ? (
          <NoSymbolIcon className={classes.disabledIcon} />
        ) : (
          <ChevronRightIcon className={classes.icon} />
        )
      }
      onClick={() => handleClick(connector, updateConnectorState)}
    />
  )
}
