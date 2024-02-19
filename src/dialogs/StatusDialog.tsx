import { DESIRED_NUMBER_OF_CONFIRMATIONS } from "@hiropay/common";
import { useEffect, useMemo } from "react";
import { PaymentError } from "../components/payment/PaymentError";
import { PaymentPending } from "../components/payment/PaymentPending";
import { PaymentSuccess } from "../components/payment/PaymentSuccess";
import { useMainStore } from "../contexts/useMainStore";
import { useBlockConfirmations } from "../hooks";

export default function StatusDialog() {
  const transaction = useMainStore((state) => state.transaction);
  const setTransaction = useMainStore((state) => state.setTransaction);
  const setTransactionConfirmed = useMainStore(
    (state) => state.setTransactionConfirmed
  );
  const { confirmations } = useBlockConfirmations();

  const confirmed = useMemo(
    () => confirmations >= DESIRED_NUMBER_OF_CONFIRMATIONS,
    [confirmations]
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

  if (transaction?.error) return <PaymentError />;
  if (transaction?.loading || !confirmed) {
    return <PaymentPending />;
  }
  if (transaction?.data) return <PaymentSuccess />;
}
