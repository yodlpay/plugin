import {
  APPROXIMATE_RATE_DECIMALS,
  Decimal,
  Flex,
  Text,
  Tooltip,
  formatPaymentAmount,
  usePaymentStyles,
} from "@hiropay/common";
import { Info } from "@phosphor-icons/react";
import { useMemo } from "react";
import truncateEthAddress from "truncate-eth-address";
import { useAccount } from "wagmi";
import { useMainStore } from "../../contexts/useMainStore";
import { usePaymentStore } from "../../contexts/usePaymentStore";
import { usePayment } from "../../hooks";
import {
  determineTokenCurrency,
  getTokenOutInfo,
  normalizeBigInt,
} from "../../utils/helpers";

export const PaymentHeader = () => {
  const { invoice } = usePayment();
  const { chain } = useAccount();

  const token = useMainStore((state) => state.token);

  const priceFeed = usePaymentStore(
    (state) => state.state.priceFeedDetails?.data
  );
  const bestSwap = usePaymentStore(({ state }) => state.swapDetails?.bestSwap);

  const { classes } = usePaymentStyles();

  const tokenOut = getTokenOutInfo(invoice, chain);

  const tokenInHasCurrency = !!token?.tokenInfo.currency;
  const tokenOutHasCurrency = !!tokenOut.currency;

  const isSwapPayment = !!bestSwap;

  const exchangeRate = normalizeBigInt(
    priceFeed?.approximateRate ?? 0n,
    APPROXIMATE_RATE_DECIMALS
  );

  const normalizedPriceFeedAmount = normalizeBigInt(
    priceFeed?.convertedAmount ?? 0n,
    priceFeed?.decimals ?? 0
  );

  const settlementTokenAmount = isSwapPayment
    ? normalizeBigInt(bestSwap[0].amountOut, tokenOut.decimals)
    : !!priceFeed
    ? normalizedPriceFeedAmount
    : new Decimal(invoice.amountInMinor).dividedBy(new Decimal(100)).toNumber();

  const settlementTokenCurrency = determineTokenCurrency(
    !!bestSwap,
    token,
    tokenOut
  );

  const formattedExchangeRate = exchangeRate
    ? `${formatPaymentAmount({
        amount: exchangeRate,
        isFiatOrStablecoin: isSwapPayment
          ? tokenOutHasCurrency
          : tokenInHasCurrency,
        shouldFormatCurrency: false,
      })} ${determineTokenCurrency(!!bestSwap, token, tokenOut)}/${
        invoice.currency
      }`
    : "";

  const formattedSettlementAmount = useMemo(
    () =>
      isSwapPayment || !!priceFeed
        ? `~${formatPaymentAmount({
            amount: settlementTokenAmount,
            currency: settlementTokenCurrency,
            isFiatOrStablecoin: tokenOutHasCurrency,
          })}`
        : "",
    [
      isSwapPayment,
      priceFeed,
      settlementTokenAmount,
      settlementTokenCurrency,
      tokenOutHasCurrency,
    ]
  );

  return (
    formattedSettlementAmount && (
      <Flex direction="column" w="100%" mb={16} gap={16}>
        {invoice.recipientAddress && (
          <Flex w="100%" direction="column">
            <Flex w="100%" align="center" justify="space-between">
              <Text c="subtle.0" size={14} align="left" mr={4}>
                Recipient address
              </Text>
              <Tooltip label={invoice.recipientAddress}>
                <Text c="primary.0" size={14} weight={500} align="right">
                  {truncateEthAddress(invoice.recipientAddress)}
                </Text>
              </Tooltip>
            </Flex>
          </Flex>
        )}
        {!!formattedExchangeRate && (
          <Flex w="100%" direction="column">
            <Flex w="100%" align="center" justify="space-between">
              <Text
                c="subtle.0"
                size={14}
                align="left"
                mr={4}
                rightIcon={
                  <Tooltip label="Current conversion rate between different currencies, reliably sourced from Chainlink oracles">
                    <Info size={16} className={classes.infoIcon} />
                  </Tooltip>
                }
              >
                Exchange rate
              </Text>
              <Text c="primary.0" size={14} weight={500} align="right">
                {formattedExchangeRate}
              </Text>
            </Flex>
          </Flex>
        )}
      </Flex>
    )
  );
};
