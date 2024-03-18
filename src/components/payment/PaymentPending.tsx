import { CheckIcon, ClockIcon } from '@heroicons/react/20/solid';
import {
  DESIRED_NUMBER_OF_CONFIRMATIONS,
  Flex,
  Loader,
  Progress,
  RudderStackJSPageCategories,
  RudderStackJSPageNames,
  Text,
} from '@hiropay/common';
import { createStyles } from '@mantine/core';
import { useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useMainStore } from '../../contexts/useMainStore';
import { useBlockConfirmations, useDynamicLoadingLabel } from '../../hooks';
import { Analytics } from '../../lib';
import { getEstimatedTime } from '../../utils/helpers';

const useStyles = createStyles((theme) => ({
  status: {
    marginBottom: '44px',
  },
  progressBar: {
    background: theme.colors?.level?.[2],
    display: 'flex',
    flexGrow: 1,
  },
  icon: {
    marginRight: '4px',
    fill: theme.colors?.primary?.[0],
  },
}));

export type PaymentPendingChildrenProps = {
  confirmed: boolean;
  loadingLabel: string;
  confirmations: number;
  DESIRED_NUMBER_OF_CONFIRMATIONS: number;
  estimatedTimeInMins: number;
  analytics: Analytics | null;
};

export type PaymentPendingProps = {
  customChildren?: boolean;
  children?: ({
    confirmed,
    loadingLabel,
    confirmations,
    DESIRED_NUMBER_OF_CONFIRMATIONS,
    estimatedTimeInMins,
    analytics,
  }: PaymentPendingChildrenProps) => JSX.Element;
};

export const PaymentPending = ({
  customChildren = false,
  children = () => <></>,
}: PaymentPendingProps) => {
  const analytics = useMainStore((state) => state.analytics);

  const { confirmations } = useBlockConfirmations();

  const { chain } = useAccount();

  const confirmed = useMemo(
    () => confirmations >= DESIRED_NUMBER_OF_CONFIRMATIONS,
    [confirmations],
  );

  const loadingLabel = useDynamicLoadingLabel({
    labels: [
      'Awaiting block confirmations',
      'Blocks are being mined',
      'Climbing the block ladder',
      'Miners are hard at work',
      'Crossing the block bridge',
      'Diving deeper into block depths',
      'Moving up the blockchain ranks',
      "Under the miner's hammer",
      'Chain of blocks growing stronger',
      'Bracing for the final block nod',
    ],
    shouldFallback: false,
    delay: 2000,
    shouldStop: confirmed,
  });

  const estimatedTimeInMins = Math.ceil(
    getEstimatedTime(chain?.id as number) / 60,
  );

  const { classes } = useStyles();

  useEffect(() => {
    analytics?.page(
      RudderStackJSPageCategories.Payment,
      RudderStackJSPageNames.PendingDialog,
    );
  }, [analytics]);

  return customChildren ? (
    children({
      confirmed,
      loadingLabel,
      confirmations,
      DESIRED_NUMBER_OF_CONFIRMATIONS,
      estimatedTimeInMins,
      analytics,
    })
  ) : (
    <Flex
      direction="column"
      align="center"
      justify="center"
      grow={1}
      maw={312}
      w="100%"
      mx="auto"
    >
      <img
        src={'/assets/images/status/pending.svg'}
        aria-hidden="true"
        alt="Payment pending"
        className={classes.status}
      />
      <Text c="primary.0" size={22} weight={600} mb={12}>
        Payment in progress
      </Text>
      <Text c="subtle.0" size={16} align="center">
        {confirmed ? 'Payment confirmed' : loadingLabel}
      </Text>
      <Flex h={20} w="100%" gap={4} my={24}>
        {Array.from({ length: DESIRED_NUMBER_OF_CONFIRMATIONS }).map((_, i) => (
          <Progress
            key={i}
            color="brand.0"
            value={i < confirmations ? 100 : i === confirmations ? 100 : 0}
            animate={i >= confirmations ? true : false}
            className={classes.progressBar}
            size="sm"
          />
        ))}
      </Flex>
      <Flex w="100%" align="center" justify="space-between">
        <Text
          c="primary.0"
          size={13}
          weight={500}
          icon={
            confirmations < DESIRED_NUMBER_OF_CONFIRMATIONS ? (
              <Loader color="primary.0" size={14} mr={4} />
            ) : (
              <CheckIcon width="16px" height="16px" className={classes.icon} />
            )
          }
        >
          TX Confirmation...
        </Text>
        <Text
          c="primary.0"
          size={13}
          weight={500}
          icon={
            <ClockIcon width="16px" height="16px" className={classes.icon} />
          }
        >
          {estimatedTimeInMins} min
        </Text>
      </Flex>
    </Flex>
  );
};
