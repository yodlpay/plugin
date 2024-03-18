import {
  Flex,
  Loader,
  Text,
  formatPaymentAmount,
  usePaymentStyles,
} from '@hiropay/common';
import { clsx } from '@mantine/core';
import { TokenInfo, getTokenBySymbol } from '@yodlpay/tokenlists';
import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { usePaymentStore } from '../../contexts/usePaymentStore';
import { normalizeBigInt } from '../../utils/helpers';

export type PaymentFooterChildrenProps = {
  gasLoading: boolean | undefined;
  nativeToken: TokenInfo | null;
  formattedGasInNativeCurrency: string;
  formattedGasInUsd: string;
};

export type PaymentFooterProps = {
  customChildren?: boolean;
  children?: ({
    gasLoading,
    nativeToken,
    formattedGasInNativeCurrency,
    formattedGasInUsd,
  }: PaymentFooterChildrenProps) => JSX.Element;
};

export const PaymentFooter = ({
  customChildren = false,
  children = () => <></>,
}: PaymentFooterProps) => {
  const allowanceOk = usePaymentStore(
    (state) => state.state.allowanceDetails?.data,
  );
  const gasLoading = usePaymentStore(
    (state) => state.state.gasDetails?.loading,
  );
  const gasError = usePaymentStore((state) => state.state.gasDetails?.error);
  const gasDetails = usePaymentStore(({ state }) => state.gasDetails?.data);

  const { chain } = useAccount();

  const nativeToken = getTokenBySymbol(chain?.nativeCurrency.symbol ?? '');

  const { classes } = usePaymentStyles();

  const calculatedGasInNativeCurrency = gasDetails?.gas
    ? normalizeBigInt(
        gasDetails?.gas * gasDetails?.gasPrice,
        chain?.nativeCurrency.decimals ?? 0,
      )
    : 0;

  const calculatedGasInUsd = gasDetails?.gas
    ? normalizeBigInt(gasDetails?.gasInUsd, gasDetails?.tokenOut?.decimals ?? 0)
    : 0;

  const gasInNativeCurrency = useMemo(
    () =>
      gasDetails?.gas
        ? `${formatPaymentAmount({
            amount: calculatedGasInNativeCurrency,
            currency: chain?.nativeCurrency.symbol,
            isFiatOrStablecoin: false,
          })}`
        : '',
    [
      calculatedGasInNativeCurrency,
      chain?.nativeCurrency.symbol,
      gasDetails?.gas,
    ],
  );

  const formattedGasInNativeCurrency = useMemo(
    () =>
      gasInNativeCurrency
        ? gasInNativeCurrency
        : allowanceOk || gasError
          ? 'Failed to determine gas fees'
          : 'Requires token to be approved',
    [allowanceOk, gasInNativeCurrency, gasError],
  );

  const formattedGasInUsd = useMemo(
    () =>
      calculatedGasInUsd
        ? `~${formatPaymentAmount({
            amount: calculatedGasInUsd,
            currency: 'USD',
            isFiatOrStablecoin: true,
          })}`
        : '',
    [calculatedGasInUsd],
  );

  return customChildren ? (
    children({
      gasLoading,
      nativeToken,
      formattedGasInNativeCurrency,
      formattedGasInUsd,
    })
  ) : (
    <Flex direction="column" w="100%">
      <Flex
        className={clsx(classes.flex, classes.noGrow)}
        justify="space-between"
        mt={12}
      >
        <Text c="subtle.0" size={14} align="left">
          Gas
        </Text>
        <Flex justify="flex-end" flex={1}>
          <Flex align="center">
            <Text
              c="primary.0"
              weight={500}
              size={14}
              mr={6}
              align="right"
              rightIcon={
                gasLoading ? (
                  <Loader color="subtle.0" size={16} />
                ) : nativeToken?.logoUri ? (
                  <img
                    src={nativeToken?.logoUri}
                    alt="Token Logo"
                    width="16px"
                  />
                ) : null
              }
            >
              {gasLoading
                ? 'Estimating gas fees'
                : formattedGasInNativeCurrency}
            </Text>
          </Flex>
          {formattedGasInUsd ? (
            <Flex
              className={clsx(classes.flex, classes.noGrow)}
              justify="flex-end"
              align="center"
              ml={8}
              flex={0}
            >
              <Text c="subtle.0" weight={500} size={14} align="right" mr={6}>
                {formattedGasInUsd}
              </Text>
            </Flex>
          ) : null}
        </Flex>
      </Flex>
      {/* TODO Uncomment when we introduce badges and XP */}
      {/* <Flex
        className={clsx(classes.flex, classes.noGrow)}
        justify="space-between"
        mt={12}
      >
        <Text c="subtle.0" size={14} align="left">
          Earn
        </Text>
        <Flex justify="flex-end" flex={1}>
          <Badge
            variant="filled"
            color="yellow.6"
            leftSection={<Emoji symbol="✨" mr={4} />}
            className={classes.badge}
          >
            OG YODLER badge
          </Badge>
        </Flex>
      </Flex> */}
    </Flex>
  );
};
