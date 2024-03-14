import {
  Button,
  Flex,
  RudderStackJSEvents,
  RudderStackJSPageCategories,
  RudderStackJSPageNames,
  Text,
} from '@hiropay/common'
import { createStyles } from '@mantine/core'
import { useEffect } from 'react'
import { useMainStore } from '../contexts/useMainStore'
import { CallbackAction, CallbackPage } from '../lib'

const useStyles = createStyles(() => ({
  flex: {
    marginTop: '34px',
    height: '200px',
  },
}))

export type WelcomeDialogChildrenProps = {
  handleClick: () => void
  eventCallback: (
    action: CallbackAction,
    params?: Record<string, unknown> | undefined,
  ) => void
  pageCallback: (
    category: RudderStackJSPageCategories.Payment,
    page: CallbackPage,
    params?: Record<string, unknown> | undefined,
  ) => void
}

export type WelcomeDialogProps = {
  customChildren?: boolean
  children?: ({
    handleClick,
    eventCallback,
    pageCallback,
  }: WelcomeDialogChildrenProps) => JSX.Element
  onContinue: () => void
}

export default function WelcomeDialog({
  customChildren = false,
  children = () => <></>,
  onContinue,
}: WelcomeDialogProps) {
  const eventCallback = useMainStore((state) => state.eventCallback)
  const pageCallback = useMainStore((state) => state.pageCallback)

  const { classes } = useStyles()

  const handleClick = () => {
    eventCallback?.(RudderStackJSEvents.WelcomeDialogSkipped)
    onContinue()
  }

  useEffect(() => {
    pageCallback?.(
      RudderStackJSPageCategories.Payment,
      RudderStackJSPageNames.WelcomeDialog,
    )
  }, [pageCallback])

  return customChildren ? (
    children({
      handleClick,
      eventCallback,
      pageCallback,
    })
  ) : (
    <Flex grow={1} direction="column" gap="16px" justify="center">
      <Flex justify="center" align="center" className={classes.flex}>
        <img src={'/assets/images/logo.svg'} alt="Logo" width="220px" />
      </Flex>
      <Flex direction="column" flex={1} gap="16px">
        <Text c="primary.0" weight={600} size={20} mt={24}>
          Pay the DeFi way
        </Text>
        <Text c="subtle.0" weight={500} size={15} mb={76}>
          YODL utilises existing DeFi applications to connect your payments to
          the recipient with 0 fees on P2P payments.
        </Text>
      </Flex>
      <Button c="onColor.0" color="brand.0" onClick={handleClick}>
        Continue
      </Button>
    </Flex>
  )
}
