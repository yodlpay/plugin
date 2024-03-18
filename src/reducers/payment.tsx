import {
  AllowanceState,
  DirectPaymentState,
  GasState,
  PriceFeedState,
  Quote,
  RemainderDetails,
  STABLECOIN_SLIPPAGE,
  SwapState,
  SwapVenue,
} from '@hiropay/common';

export type Action =
  | { type: 'SET_DIRECT_PAYMENT_LOADING'; payload: boolean }
  | { type: 'SET_DIRECT_PAYMENT_ERROR'; payload: string }
  | { type: 'SET_DIRECT_PAYMENT_DETAILS'; payload: DirectPaymentState }
  | { type: 'SET_BEST_SWAP'; payload: [Quote, SwapVenue] }
  | { type: 'SET_SWAP_LOADING'; payload: boolean }
  | { type: 'SET_SWAP_ERROR'; payload: string }
  | { type: 'SET_SWAP_DETAILS'; payload: SwapState }
  | { type: 'SET_GAS_LOADING'; payload: boolean }
  | { type: 'SET_GAS_ERROR'; payload: string }
  | { type: 'SET_GAS_DETAILS'; payload: GasState }
  | { type: 'SET_REMAINDER_DETAILS'; payload: RemainderDetails }
  | { type: 'SET_ALLOWANCE_LOADING'; payload: boolean }
  | { type: 'SET_ALLOWANCE_ERROR'; payload: string }
  | { type: 'SET_ALLOWANCE_DETAILS'; payload: AllowanceState }
  | { type: 'SET_SLIPPAGE'; payload: number }
  | {
      type: 'SET_SWAP_STATE';
      payload: {
        swapDetails: SwapState;
      };
    }
  | { type: 'RESET_SWAP_STATE' }
  | {
      type: 'SET_GAS_STATE';
      payload: { gasDetails: GasState; remainderDetails: RemainderDetails };
    }
  | { type: 'RESET_GAS_STATE' }
  | { type: 'SET_PRICE_FEED_LOADING'; payload: boolean }
  | { type: 'SET_PRICE_FEED_ERROR'; payload: string }
  | {
      type: 'SET_PRICE_FEED_DETAILS';
      payload: PriceFeedState;
    }
  | { type: 'RESET_PRICE_FEED_DETAILS' }
  | { type: 'RESET_PAYMENT_STATE' };

export type State = {
  directPaymentDetails: DirectPaymentState | null;
  swapDetails: SwapState | null;
  gasDetails: GasState | null;
  remainderDetails: RemainderDetails | null;
  allowanceDetails: AllowanceState | null;
  slippage: number;
  priceFeedDetails: PriceFeedState | null;
};

export const actions = {
  SET_DIRECT_PAYMENT_LOADING: 'SET_DIRECT_PAYMENT_LOADING',
  SET_DIRECT_PAYMENT_ERROR: 'SET_DIRECT_PAYMENT_ERROR',
  SET_DIRECT_PAYMENT_DETAILS: 'SET_DIRECT_PAYMENT_DETAILS',
  SET_GAS_DETAILS: 'SET_GAS_DETAILS',
  SET_REMAINDER_DETAILS: 'SET_REMAINDER_DETAILS',
  SET_ALLOWANCE_LOADING: 'SET_ALLOWANCE_LOADING',
  SET_ALLOWANCE_ERROR: 'SET_ALLOWANCE_ERROR',
  SET_ALLOWANCE_DETAILS: 'SET_ALLOWANCE_DETAILS',
  SET_SLIPPAGE: 'SET_SLIPPAGE',
  SET_BEST_SWAP: 'SET_BEST_SWAP',
  SET_SWAP_LOADING: 'SET_SWAP_LOADING',
  SET_SWAP_ERROR: 'SET_SWAP_ERROR',
  SET_SWAP_DETAILS: 'SET_SWAP_DETAILS',
  RESET_SWAP_STATE: 'RESET_SWAP_STATE',
  SET_GAS_LOADING: 'SET_GAS_LOADING',
  SET_GAS_ERROR: 'SET_GAS_ERROR',
  SET_GAS_STATE: 'SET_GAS_STATE',
  RESET_GAS_STATE: 'RESET_GAS_STATE',
  SET_PRICE_FEED_LOADING: 'SET_PRICE_FEED_LOADING',
  SET_PRICE_FEED_ERROR: 'SET_PRICE_FEED_ERROR',
  SET_PRICE_FEED_DETAILS: 'SET_PRICE_FEED_DETAILS',
  RESET_PRICE_FEED_DETAILS: 'RESET_PRICE_FEED_DETAILS',
  RESET_PAYMENT_STATE: 'RESET_PAYMENT_STATE',
} as const;

export const initialState: State = {
  directPaymentDetails: null,
  swapDetails: null,
  gasDetails: null,
  remainderDetails: null,
  allowanceDetails: null,
  slippage: STABLECOIN_SLIPPAGE,
  priceFeedDetails: null,
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actions.SET_DIRECT_PAYMENT_LOADING:
      return {
        ...state,
        directPaymentDetails: {
          ...(state.directPaymentDetails as DirectPaymentState),
          loading: action.payload,
        },
      };
    case actions.SET_DIRECT_PAYMENT_ERROR:
      return {
        ...state,
        directPaymentDetails: {
          ...(state.directPaymentDetails as DirectPaymentState),
          error: action.payload,
          loading: false,
        },
      };
    case actions.SET_DIRECT_PAYMENT_DETAILS:
      return { ...state, directPaymentDetails: action.payload };
    case actions.SET_BEST_SWAP:
      return {
        ...state,
        swapDetails: {
          ...(state.swapDetails as SwapState),
          bestSwap: action.payload,
        },
      };
    case actions.SET_SWAP_LOADING:
      return {
        ...state,
        swapDetails: {
          ...(state.swapDetails as SwapState),
          loading: action.payload,
        },
      };
    case actions.SET_SWAP_ERROR:
      return {
        ...state,
        swapDetails: {
          ...(state.swapDetails as SwapState),
          error: action.payload,
          loading: false,
        },
      };
    case actions.SET_SWAP_DETAILS:
      return { ...state, swapDetails: action.payload };
    case actions.SET_GAS_LOADING:
      return {
        ...state,
        gasDetails: {
          ...(state.gasDetails as GasState),
          loading: action.payload,
        },
      };
    case actions.SET_GAS_ERROR:
      return {
        ...state,
        gasDetails: {
          ...(state.gasDetails as GasState),
          error: action.payload,
          loading: false,
        },
      };
    case actions.SET_GAS_DETAILS:
      return { ...state, gasDetails: action.payload };
    case actions.SET_PRICE_FEED_LOADING:
      return {
        ...state,
        priceFeedDetails: {
          ...(state.priceFeedDetails as PriceFeedState),
          loading: action.payload,
        },
      };
    case actions.SET_PRICE_FEED_ERROR:
      return {
        ...state,
        priceFeedDetails: {
          ...(state.priceFeedDetails as PriceFeedState),
          error: action.payload,
          loading: false,
        },
      };
    case actions.SET_REMAINDER_DETAILS:
      return { ...state, remainderDetails: action.payload };
    case actions.SET_ALLOWANCE_LOADING:
      return {
        ...state,
        allowanceDetails: {
          ...(state.allowanceDetails as AllowanceState),
          loading: action.payload,
        },
      };
    case actions.SET_ALLOWANCE_ERROR:
      return {
        ...state,
        allowanceDetails: {
          ...(state.allowanceDetails as AllowanceState),
          error: action.payload,
        },
      };
    case actions.SET_ALLOWANCE_DETAILS:
      return { ...state, allowanceDetails: action.payload };
    case actions.SET_SLIPPAGE:
      return { ...state, slippage: action.payload };
    case actions.RESET_SWAP_STATE:
      return {
        ...state,
        swapDetails: {
          bestSwap: null,
          swapQuotes: null,
          loading: false,
          error: null,
        },
      };
    case actions.SET_GAS_STATE:
      return {
        ...state,
        ...action.payload,
      };
    case actions.RESET_GAS_STATE:
      return {
        ...state,
        gasDetails: null,
        remainderDetails: null,
      };
    case actions.SET_PRICE_FEED_DETAILS:
      return {
        ...state,
        priceFeedDetails: action.payload,
      };
    case actions.RESET_PRICE_FEED_DETAILS:
      return {
        ...state,
        priceFeedDetails: null,
      };
    case actions.RESET_PAYMENT_STATE:
      return {
        ...initialState,
      };
    default:
      throw new Error('Unknown action type');
  }
};
