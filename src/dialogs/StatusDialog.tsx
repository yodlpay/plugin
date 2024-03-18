import {
  DESIRED_NUMBER_OF_CONFIRMATIONS,
  TransactionState,
} from '@hiropay/common';
import { useEffect, useMemo } from 'react';
import { PaymentError } from '../components/payment/PaymentError';
import { PaymentPending } from '../components/payment/PaymentPending';
import { PaymentSuccess } from '../components/payment/PaymentSuccess';
import { useMainStore } from '../contexts/useMainStore';
import { useBlockConfirmations } from '../hooks';

export type StatusDialogChildrenProps = {
  transaction: TransactionState | null;
  confirmed: boolean;
};

export type StatusDialogProps = {
  customChildren?: boolean;
  children?: ({
    transaction,
    confirmed,
  }: StatusDialogChildrenProps) => JSX.Element;
};

export default function StatusDialog({
  customChildren = false,
  children = () => <></>,
}: StatusDialogProps) {
  const transaction = useMainStore((state) => state.transaction);
  const setTransaction = useMainStore((state) => state.setTransaction);
  const setTransactionConfirmed = useMainStore(
    (state) => state.setTransactionConfirmed,
  );
  const { confirmations } = useBlockConfirmations();

  const confirmed = useMemo(
    () => confirmations >= DESIRED_NUMBER_OF_CONFIRMATIONS,
    [confirmations],
  );

  useEffect(() => {
    if (!!transaction?.data?.hash && confirmed) {
      setTransactionConfirmed(confirmed);
    }
  }, [
    confirmed,
    setTransaction,
    setTransactionConfirmed,
    transaction?.data?.hash,
  ]);

  if (customChildren)
    return children({
      transaction,
      confirmed,
    });

  if (transaction?.error) return <PaymentError />;
  if (transaction?.loading || !confirmed) {
    return <PaymentPending />;
  }
  if (transaction?.data) return <PaymentSuccess />;
}
