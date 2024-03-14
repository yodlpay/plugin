import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid'
import {
  Button,
  Flex,
  MOBILE_BREAKPOINT,
  OnCompleteActionType,
  REDIRECT_COUNTDOWN_KEYWORD,
  REDIRECT_UNIT_KEYWORD,
  RudderStackJSPageCategories,
  RudderStackJSPageNames,
  Text,
} from '@hiropay/common'
import { createStyles, rem } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { useMainStore } from '../../contexts/useMainStore'
import { useOnCompleteAction } from '../../hooks'
import { getReceiptUrl } from '../../utils/helpers'

const useStyles = createStyles((theme) => ({
  status: {
    marginBottom: '44px',
  },
  icon: {
    marginLeft: '-6px',
    fill: theme.colors?.indigo?.[9],
  },
  label: {
    marginBottom: rem(12),
    [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
      marginBottom: rem(8),
    },
  },
  action: {
    marginTop: rem(12),
    [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
      marginTop: rem(8),
    },
  },
  cta: {
    minHeight: '136px',
    padding: '24px 16px',
    background: theme.colors?.level?.[1],
    borderRadius: theme.radius.xl,
    marginTop: rem(40),
    marginBottom: rem(24),
    [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
      padding: '12px 16px',
      marginTop: rem(16),
      marginBottom: rem(16),
    },
  },
  ctaLabel: {
    textAlign: 'center',
    fontSize: rem(16),
    [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
      fontSize: rem(15),
    },
  },
  button: {
    marginTop: rem(24),
    '& .mantine-Button-label': {
      color: `${theme.colors?.onColor} !important`,
    },
    [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
      marginTop: rem(16),
    },
  },
  receiptLink: {
    color: theme.colors?.brand?.[0],
  },
}))

export type PaymentSuccessChildrenProps = {
  origin: string
  receiptUrl: string
  secondsLeft: number | null
  actionLabel: string | undefined
}

export type PaymentSuccessProps = {
  customChildren?: boolean
  children?: ({
    origin,
    receiptUrl,
    secondsLeft,
    actionLabel,
  }: PaymentSuccessChildrenProps) => JSX.Element
}

export const PaymentSuccess = ({
  customChildren = false,
  children = () => <></>,
}: PaymentSuccessProps) => {
  const analytics = useMainStore((state) => state.analytics)
  const transaction = useMainStore((state) => state.transaction)
  const setCloseModal = useMainStore((state) => state.setCloseModal)

  const chain = transaction?.data?.chain ?? null
  const receiptUrl = getReceiptUrl(chain, transaction?.data?.hash)

  const [origin, setOrigin] = useState('')

  // TODO - commented out for now since footnote is not needed
  // const finalityDuration = chain ? AVERAGE_FINALITY_DURATION[chain.id] : null;

  // TODO - commented out for now since CTA is not needed
  // const { action, isValidAction } = validateSearchParams(
  //   new URLSearchParams(window.location.search)
  // );

  // const isUnverifiedPayment =
  //   action === PaymentLinkAction.TEST && isValidAction;

  const handleClose = useCallback(() => {
    setCloseModal()
  }, [setCloseModal])

  const { secondsLeft, actionType, actionText } =
    useOnCompleteAction(handleClose)

  const formattedActionText =
    actionText
      ?.replace(REDIRECT_COUNTDOWN_KEYWORD, secondsLeft?.toString() ?? '0')
      .replace(
        REDIRECT_UNIT_KEYWORD,
        `second${secondsLeft === 1 ? '' : 's'}`,
      ) ?? ''

  const actionLabel = {
    [OnCompleteActionType.REDIRECT]:
      formattedActionText ??
      `Redirecting you back to merchant in ${secondsLeft} second${
        secondsLeft === 1 ? '' : 's'
      }...`,
    [OnCompleteActionType.CLOSE_WINDOW]:
      formattedActionText ??
      `The modal will close in ${secondsLeft} second${
        secondsLeft === 1 ? '' : 's'
      }...`,
    [OnCompleteActionType.NOTHING]: '',
  }[actionType as string]

  const { classes } = useStyles()

  useEffect(() => {
    analytics?.page(
      RudderStackJSPageCategories.Payment,
      RudderStackJSPageNames.SuccessDialog,
      { receiptUrl },
    )
  }, [analytics, receiptUrl])

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  return customChildren ? (
    children({
      origin,
      receiptUrl,
      secondsLeft,
      actionLabel,
    })
  ) : (
    <Flex
      direction="column"
      align="center"
      justify="center"
      grow={1}
      maw={408}
      w="100%"
      mx="auto"
    >
      <img
        src={'/assets/images/status/success.svg'}
        aria-hidden="true"
        alt="Payment successful"
        className={classes.status}
      />
      <Text c="primary.0" size={22} weight={600} className={classes.label}>
        Payment complete!
      </Text>
      <Text c="subtle.0" size={16} align="center" className={classes.label}>
        Sufficient checks have been completed.*
      </Text>
      <Button
        target="_blank"
        component="a"
        href={`${origin}/${receiptUrl}`}
        variant="link"
        className={classes.receiptLink}
        rightIcon={
          <ArrowTopRightOnSquareIcon
            width="20px"
            height="20px"
            className={classes.icon}
          />
        }
      >
        View receipt
      </Button>
      {secondsLeft !== null && actionLabel ? (
        <Text c="subtle.0" size={14} align="center" className={classes.action}>
          {actionLabel}
        </Text>
      ) : null}
      {/* TODO - for now remove the CTA from the payment success page */}
      {/* {!isUnverifiedPayment && (
        <Flex
          direction="column"
          align="center"
          justify="center"
          className={classes.cta}
        >
          <Text
            c="primary.0"
            weight={500}
            icon={<Emoji symbol="✨" mr={4} />}
            className={classes.ctaLabel}
          >
            Try YODL today and start receiving payments
          </Text>
          <Button
            color="brand.0"
            target="_blank"
            component="a"
            href="https://yodl.me/login"
            fullWidth
            className={classes.button}
          >
            Create account
          </Button>
        </Flex>
      )} */}
      {/* TODO - for now remove the footnote from the payment success page */}
      {/* {finalityDuration && chain && (
        <Text c="subtle.0" size={13} align="center">
          *Full confirmation of finality takes up to {finalityDuration} on{" "}
          {chain.name}.
        </Text>
      )} */}
    </Flex>
  )
}
