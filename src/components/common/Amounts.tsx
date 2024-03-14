import { CheckIcon, Square2StackIcon } from '@heroicons/react/24/outline'
import {
  Button,
  Flex,
  Text,
  useCopyToClipboard,
  usePaymentStyles,
} from '@hiropay/common'
import { Repeat } from '@phosphor-icons/react'
import truncateEthAddress from 'truncate-eth-address'

type PaymentWindowProps = {
  label: string
  secondaryLabel: string
  address?: string
  amount: string
  amountSize?: number
  icon?: string
  convertedAmount?: string
  convertedAmountWeight?: number
  isSameCurrency?: boolean
}

const PaymentWindow = ({
  label,
  secondaryLabel,
  address,
  amount,
  amountSize = 22,
  icon,
  convertedAmount,
  convertedAmountWeight = 400,
  isSameCurrency,
}: PaymentWindowProps) => {
  const { classes } = usePaymentStyles()

  const [isCopied, copy] = useCopyToClipboard()

  const handleCopy = (address: string) => {
    copy(address)
  }

  return (
    <Flex className={classes.paymentWindow}>
      <Flex direction="column">
        <Text c="subtle.0" weight={500} size={13} align="left">
          {label}
        </Text>
        {address && (
          <Text
            c="subtle.0"
            weight={500}
            size={13}
            align="left"
            className={classes.address}
          >
            {secondaryLabel}
            <Button variant="unstyled" onClick={() => handleCopy(address)}>
              <Text
                c="primary.0"
                weight={500}
                size={14}
                ml={4}
                rightIcon={
                  isCopied ? (
                    <CheckIcon className={classes.copyExternalIcon} />
                  ) : (
                    <Square2StackIcon className={classes.copyExternalIcon} />
                  )
                }
              >
                {truncateEthAddress(address)}
              </Text>
            </Button>
          </Text>
        )}
      </Flex>
      <Flex direction="column" flex={1} align="flex-end">
        <Flex align="center">
          <Text
            c="primary.0"
            weight={500}
            size={amountSize}
            mr={8}
            align="right"
          >
            {amount}
          </Text>
          {icon && <img src={icon} alt="Token Logo" width="24px" />}
        </Flex>
        {!isSameCurrency && convertedAmount ? (
          <Text
            c="subtle.0"
            weight={convertedAmountWeight}
            size={14}
            align="right"
          >
            {convertedAmount}
          </Text>
        ) : null}
      </Flex>
    </Flex>
  )
}

export type AmountsProps = {
  amountOut: string
  convertedAmountOut?: string
  amountOutIcon?: string
  amountIn: string
  convertedAmountIn?: string
  amountInIcon?: string
  isSameCurrency: boolean
  receiverAddress?: string
  senderAddress?: string
  receiverLabel?: string
  receiverSecondaryLabel?: string
  receiverAmountSize?: number
  receiverConvertedAmountWeight?: number
  senderLabel?: string
  senderSecondaryLabel?: string
  senderAmountSize?: number
  senderConvertedAmountWeight?: number
  withExchange?: boolean
}

export const Amounts = ({
  amountOut,
  convertedAmountOut,
  amountOutIcon,
  amountIn,
  convertedAmountIn,
  amountInIcon,
  isSameCurrency,
  receiverAddress,
  senderAddress,
  receiverLabel = 'They receive:',
  receiverSecondaryLabel = '',
  receiverAmountSize = 18,
  receiverConvertedAmountWeight = 400,
  senderLabel = 'You pay:',
  senderSecondaryLabel = '',
  senderAmountSize = 22,
  senderConvertedAmountWeight = 500,
  withExchange = true,
}: AmountsProps) => {
  const { classes } = usePaymentStyles()

  return (
    <Flex
      direction="column"
      w="100%"
      gap="8px"
      className={classes.paymentContainer}
    >
      <PaymentWindow
        label={receiverLabel}
        secondaryLabel={receiverSecondaryLabel}
        address={receiverAddress}
        amount={amountOut}
        amountSize={receiverAmountSize}
        icon={amountOutIcon}
        convertedAmount={convertedAmountOut}
        convertedAmountWeight={receiverConvertedAmountWeight}
        isSameCurrency={isSameCurrency}
      />
      {withExchange && (
        <Flex className={classes.paymentArrow}>
          <Repeat width="16px" className={classes.paymentArrowIcon} />
        </Flex>
      )}
      <PaymentWindow
        label={senderLabel}
        secondaryLabel={senderSecondaryLabel}
        address={senderAddress}
        amount={amountIn}
        amountSize={senderAmountSize}
        icon={amountInIcon}
        convertedAmount={convertedAmountIn}
        convertedAmountWeight={senderConvertedAmountWeight}
        isSameCurrency={isSameCurrency}
      />
    </Flex>
  )
}
