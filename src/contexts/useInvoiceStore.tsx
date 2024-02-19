import { Invoice, OnCompleteActionType } from "@hiropay/common";
import { create } from "zustand";

const initialState = {
  memo: "",
  amountInMinor: 100,
  recipientAddress: "0x0",
  extraFeeAddress: null,
  extraFeeBps: null,
  currency: "USD",
  coins: [],
  isDemo: true,
  excludedVenues: [],
  onCompleteAction: { type: OnCompleteActionType.NOTHING },
} as Invoice;

type InvoiceStoreType = {
  invoice: Invoice;
  setInvoice: (invoice: Invoice) => void;
  resetInvoiceState: () => void;
};

export const useInvoiceStore = create<InvoiceStoreType>((set) => ({
  invoice: initialState,
  setInvoice: (invoice) => set({ invoice }),
  resetInvoiceState: () => set({ invoice: { ...initialState } }),
}));

export const invoiceStore = useInvoiceStore;
