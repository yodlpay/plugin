import { create } from 'zustand'
import { Action, State, initialState, reducer } from '../reducers/payment'

type PaymentStoreType = {
  state: State
  dispatch: (action: Action) => void
}

export const usePaymentStore = create<PaymentStoreType>((set) => ({
  state: initialState,
  dispatch: (action) =>
    set((state) => ({ state: reducer(state.state, action) })),
}))

export const paymentStore = usePaymentStore
