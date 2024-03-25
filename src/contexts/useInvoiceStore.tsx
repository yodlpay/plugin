import { Invoice, OnCompleteActionType } from '@hiropay/common';
import { create } from 'zustand';

const initialState = {
  memo: '',
  amountInMinor: 100,
  recipientAddress: '0x0',
  extraFeeAddress: null,
  extraFeeBps: null,
  currency: 'USD',
  coins: [],
  isDemo: true,
  excludedVenues: [],
  onCompleteAction: { type: OnCompleteActionType.NOTHING },
} as Invoice;

type InvoiceStoreType = {
  invoice: Invoice;
  setInvoice: (invoice: Invoice) => void;
  setInvoiceAmount: (amountInMinor: number) => void;
  setInvoiceCurrency: (currency: string) => void;
  resetInvoiceState: () => void;
};

export const useInvoiceStore = create<InvoiceStoreType>((set) => ({
  invoice: initialState,
  setInvoice: (invoice) => set({ invoice }),
  setInvoiceAmount: (amountInMinor) =>
    set((prevState) => ({
      ...prevState,
      invoice: { ...prevState.invoice, amountInMinor },
    })),
  setInvoiceCurrency: (currency) =>
    set((prevState) => ({
      ...prevState,
      invoice: { ...prevState.invoice, currency },
    })),
  resetInvoiceState: () => set({ invoice: { ...initialState } }),
}));

export const invoiceStore = useInvoiceStore;
