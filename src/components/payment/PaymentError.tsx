import {
  Button,
  Flex,
  RudderStackJSPageCategories,
  RudderStackJSPageNames,
  Text,
  TransactionState,
} from '@hiropay/common';
import { createStyles } from '@mantine/core';
import { useEffect } from 'react';
import { useMainStore } from '../../contexts/useMainStore';
import { Analytics } from '../../lib';

const useStyles = createStyles(() => ({
  status: {
    marginBottom: '44px',
  },
  icon: {
    marginLeft: '-6px',
  },
}));

export type PaymentErrorChildrenProps = {
  transaction: TransactionState | null;
  analytics: Analytics | null;
  resetTransaction: () => void;
};

export type PaymentErrorProps = {
  customChildren?: boolean;
  children?: ({
    transaction,
    analytics,
    resetTransaction,
  }: PaymentErrorChildrenProps) => JSX.Element;
};

export const PaymentError = ({
  customChildren = false,
  children = () => <></>,
}: PaymentErrorProps) => {
  const analytics = useMainStore((state) => state.analytics);
  const transaction = useMainStore((state) => state.transaction);

  const resetTransaction = useMainStore((state) => state.resetTransaction);

  const { classes } = useStyles();

  useEffect(() => {
    analytics?.page(
      RudderStackJSPageCategories.Payment,
      RudderStackJSPageNames.ErrorDialog,
      { error: transaction?.error ?? 'Unknown error' },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return customChildren ? (
    children({
      transaction,
      analytics,
      resetTransaction,
    })
  ) : (
    <Flex
      direction="column"
      align="center"
      justify="center"
      grow={1}
      maw={440}
      w="100%"
      mx="auto"
    >
      <img
        src={'/assets/images/status/error.svg'}
        aria-hidden="true"
        alt="Payment failed"
        className={classes.status}
      />
      <Text c="primary.0" size={22} weight={600} mb={12}>
        Payment failed!
      </Text>
      <Text c="subtle.0" size={16} mb={16} align="center">
        The payment could not be completed for the following reason:
      </Text>
      <Text c="primary.0" size={16} weight={600} mb={16} align="center">
        {transaction?.error ?? 'Something went wrong'}
      </Text>
      <Button
        c="onColor.0"
        color="brand.0"
        mt={45}
        fullWidth
        onClick={resetTransaction}
      >
        Go back
      </Button>
    </Flex>
  );
};
