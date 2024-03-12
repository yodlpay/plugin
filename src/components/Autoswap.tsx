import {
  Button,
  Flex,
  Loader,
  Popover,
  Text,
  Tooltip,
  usePaymentStyles,
} from '@hiropay/common'
import { clsx } from '@mantine/core'
import {
  ArrowsOutSimple,
  Info,
  LinkBreak,
  Shuffle,
} from '@phosphor-icons/react'
import { ReactNode } from 'react'

export type AutoswapProps = {
  swapPath: ReactNode
  swapRate?: string
  swapVenue: string
  slippage?: string
  priceImpact?: string
  opened?: boolean
  handleChange?: (value: boolean) => void
  isError?: string | null
  isLoading?: boolean
  renderSwapPath?: (withLabel?: boolean) => ReactNode
  withPopover?: boolean
}

export const Autoswap = ({
  swapPath,
  swapRate,
  swapVenue,
  slippage,
  priceImpact,
  opened = false,
  handleChange = () => null,
  isError = null,
  isLoading = false,
  renderSwapPath = () => null,
  withPopover = true,
}: AutoswapProps) => {
  const isErrorOrLoading = !!isError || !!isLoading

  const { classes } = usePaymentStyles()

  const button = (
    <Button
      variant="unstyled"
      w="100%"
      h="100%"
      mt={8}
      disabled={isErrorOrLoading}
      className={clsx(
        classes.autoswapButton,
        opened && classes.autoswapButtonOpened,
        !withPopover && classes.autoswapButtonNoPopover,
      )}
      onClick={() => handleChange(!opened)}
    >
      <Flex
        w="100%"
        align="center"
        justify="space-between"
        className={clsx(
          classes.autoswapContainer,
          !withPopover && classes.autoswapContainerNoPopover,
        )}
      >
        <Flex>
          <Text
            icon={<Shuffle size={18} className={classes.shuffleIcon} />}
            className={classes.autoswapLabel}
          >
            Autoswap
          </Text>
        </Flex>
        <Flex>
          <Text
            c={'subtle.0'}
            size={14}
            weight={500}
            align="right"
            mr={12}
            rightIcon={
              isLoading ? (
                <Loader color="subtle.0" size={16} />
              ) : !!isError ? (
                <LinkBreak className={classes.linkBreakIcon} size={20} />
              ) : withPopover ? (
                <ArrowsOutSimple className={classes.expandIcon} size={20} />
              ) : null
            }
          >
            {swapPath}
          </Text>
        </Flex>
      </Flex>
    </Button>
  )

  return withPopover ? (
    <Popover
      opened={opened}
      onChange={handleChange}
      position="top"
      withArrow
      width="300px"
      shadow="md"
      className={classes.popover}
    >
      <Popover.Target>{button}</Popover.Target>
      <Popover.Dropdown>
        <Flex direction="column" align="center" gap="8px">
          <Flex direction="column" align="center" w="100%" p="12px">
            <Flex>{renderSwapPath(true)}</Flex>
            {swapRate && (
              <Flex
                className={clsx(classes.flex, classes.noGrow)}
                justify="space-between"
                mt={8}
              >
                <Text
                  c="subtle.0"
                  size={14}
                  align="left"
                  mr={4}
                  rightIcon={
                    <Tooltip label="Optimal swap rate derived from comprehensive market analysis">
                      <Info size={16} className={classes.infoIcon} />
                    </Tooltip>
                  }
                >
                  Rate
                </Text>
                <Text c="primary.0" weight={500} size={14} align="right">
                  {swapRate}
                </Text>
              </Flex>
            )}
            {swapVenue && (
              <Flex
                className={clsx(classes.flex, classes.noGrow)}
                justify="space-between"
                mt={8}
              >
                <Text
                  c="subtle.0"
                  size={14}
                  align="left"
                  mr={4}
                  rightIcon={
                    <Tooltip label="The selected service facilitating the swap in the transaction">
                      <Info size={16} className={classes.infoIcon} />
                    </Tooltip>
                  }
                >
                  Provider
                </Text>
                <Text c="primary.0" weight={500} size={14} align="right">
                  {swapVenue}
                </Text>
              </Flex>
            )}
            {priceImpact && (
              <Flex
                className={clsx(classes.flex, classes.noGrow)}
                justify="space-between"
                mt={8}
              >
                <Text
                  c="subtle.0"
                  size={14}
                  align="left"
                  mr={4}
                  rightIcon={
                    <Tooltip label="Estimated price change due to the transaction's size against market liquidity">
                      <Info size={16} className={classes.infoIcon} />
                    </Tooltip>
                  }
                >
                  Price impact
                </Text>
                <Text c="primary.0" weight={500} size={14} align="right">
                  {priceImpact}
                </Text>
              </Flex>
            )}
            {slippage && (
              <Flex
                className={clsx(classes.flex, classes.noGrow)}
                justify="space-between"
                mt={8}
              >
                <Text
                  c="subtle.0"
                  size={14}
                  align="left"
                  mr={4}
                  rightIcon={
                    <Tooltip label="Maximum allowed price variation during your transaction execution">
                      <Info size={16} className={classes.infoIcon} />
                    </Tooltip>
                  }
                >
                  Slippage tolerance
                </Text>
                <Text c="primary.0" weight={500} size={14} align="right">
                  {slippage}
                </Text>
              </Flex>
            )}
          </Flex>
        </Flex>
      </Popover.Dropdown>
    </Popover>
  ) : (
    button
  )
}
