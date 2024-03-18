import {
  AddressZero,
  coinIdToToken,
  coinIdsToCoinConfig,
} from '@hiropay/common';
import { TokenInfo } from '@yodlpay/tokenlists';
import {
  Address,
  decodeAbiParameters,
  parseAbiParameters,
  stringToHex,
} from 'viem';
import { describe } from 'vitest';
import { mainnet } from 'wagmi/chains';
import { Invoice, PriceFeedDetails, Quote, SwapVenue } from '@hiropay/common';
import { createPayload, createPayloadV1, padAddress } from '../utils/helpers';

const USDT = coinIdToToken('USDT-1') as TokenInfo;
const WETH = coinIdToToken('WETH-1') as TokenInfo;
const USDC = coinIdToToken('USDC-1') as TokenInfo;
const EURe = coinIdToToken('EURe-1') as TokenInfo;
const ETH = coinIdToToken('ETH-1') as TokenInfo;
const HEX = {
  name: 'Hex',
  chainId: 1,
  decimals: 8,
  address: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
  symbol: 'HEX',
} as TokenInfo;
const FTM = {
  name: 'Fantom',
  chainId: 1,
  decimals: 18,
  address: '0x4E15361FD6b4BB609Fa63C81A2be19d873717870',
  symbol: 'FTM',
} as TokenInfo;
const sender = padAddress('1337');
const receiver = padAddress('1338');

describe('createPayloadV1', () => {
  test('correctly determines `payWithToken` payload', async () => {
    const tokenIn = USDC;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: AddressZero as Address,
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['USDC-1']),
      amountInMinor: 100,
      memo: '',
      excludedVenues: [],
    };
    const payload = createPayloadV1(
      sender,
      tokenIn,
      invoice,
      mainnet,
      undefined,
      undefined,
    );

    expect(payload.contractFunctionName).toBe('payWithToken');
    expect(payload.contractArgs.length).toBe(7);
    expect(payload.contractArgs).toStrictEqual([
      stringToHex('', { size: 32 }),
      10n ** BigInt(USDC.decimals),
      [],
      USDC.address,
      receiver,
      AddressZero,
      0,
    ]);
    expect(payload.value).toBe(0n);
    expect(payload.isSwap).toBe(false);
  });

  test('correctly determines `payWithToken` payload for a memo and one price feed', async () => {
    const tokenIn = USDC;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'EUR',
      extraFeeAddress: AddressZero as Address,
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['USDC-1']),
      amountInMinor: 100,
      memo: 'asdf',
      excludedVenues: [],
    };
    const priceFeedDetails = {
      feedAddresses: [padAddress('1'), AddressZero],
      approximateRate: 90000000n,
      convertedAmount: 1100000n,
    } as PriceFeedDetails;
    const payload = createPayloadV1(
      sender,
      tokenIn,
      invoice,
      mainnet,
      undefined,
      undefined,
      priceFeedDetails,
    );

    expect(payload.contractFunctionName).toBe('payWithToken');
    expect(payload.contractArgs.length).toBe(7);
    expect(payload.contractArgs).toStrictEqual([
      stringToHex('asdf', { size: 32 }),
      10n ** BigInt(USDC.decimals),
      [padAddress('1')],
      USDC.address,
      receiver,
      AddressZero,
      0,
    ]);
    expect(payload.value).toBe(0n);
    expect(payload.isSwap).toBe(false);
  });

  test('correctly converts bps to divisor', async () => {
    const tokenIn = USDC;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: padAddress('1234'),
      extraFeeBps: 25,
      coins: coinIdsToCoinConfig(['USDC-1']),
      amountInMinor: 100,
      memo: '',
      excludedVenues: [],
    };
    const payload = createPayloadV1(
      sender,
      tokenIn,
      invoice,
      mainnet,
      undefined,
      undefined,
    );

    expect(payload.contractFunctionName).toBe('payWithToken');
    expect(payload.contractArgs.length).toBe(7);
    expect(payload.contractArgs).toStrictEqual([
      stringToHex('', { size: 32 }),
      10n ** BigInt(USDC.decimals),
      [],
      USDC.address,
      receiver,
      padAddress('1234'),
      400,
    ]);
    expect(payload.value).toBe(0n);
    expect(payload.isSwap).toBe(false);
  });

  test('throws an error if we give it swap parameters', async () => {
    const tokenIn = USDC;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: AddressZero as Address,
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['USDC-1']),
      amountInMinor: 100,
      memo: '',
      excludedVenues: [],
    };
    const swapQuote = {
      path: [
        {
          poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
          tokenIn: WETH.address,
          tokenOut: USDC.address,
          poolFee: '500',
          amountIn: 10000000000000000n,
          amountOut: 2500000n,
        },
      ],
      amountIn: 10000000000000000n,
      amountOut: 2500000n,
    } as Quote;
    const swapVenue = SwapVenue.UNISWAP;
    expect(() =>
      createPayloadV1(sender, tokenIn, invoice, mainnet, swapQuote, swapVenue),
    ).toThrowError('Swaps are not supported with the V1 router.');
  });

  test('throws an error if we give it two price feeds', async () => {
    const tokenIn = USDC;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: AddressZero as Address,
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['USDC-1']),
      amountInMinor: 100,
      memo: '',
      excludedVenues: [],
    };
    const priceFeedDetails = {
      feedAddresses: [padAddress('1'), padAddress('2')],
      approximateRate: 50000000n,
      convertedAmount: 45000000n,
    } as PriceFeedDetails;
    expect(() =>
      createPayloadV1(
        sender,
        tokenIn,
        invoice,
        mainnet,
        undefined,
        undefined,
        priceFeedDetails,
      ),
    ).toThrowError(
      'Multiple or inverse price feeds are not supported in the V1 router.',
    );
  });

  test('throws an error if we give it an inverse price feed', async () => {
    const tokenIn = USDC;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: AddressZero as Address,
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['USDC-1']),
      amountInMinor: 100,
      memo: '',
      excludedVenues: [],
    };
    const priceFeedDetails = {
      feedAddresses: [AddressZero, padAddress('2')],
      approximateRate: 100000000n,
      convertedAmount: 1000000n,
    } as PriceFeedDetails;
    await expect(() =>
      createPayloadV1(
        sender,
        tokenIn,
        invoice,
        mainnet,
        undefined,
        undefined,
        priceFeedDetails,
      ),
    ).toThrowError(
      'Multiple or inverse price feeds are not supported in the V1 router.',
    );
  });

  test('throws an error if we use ETH', async () => {
    const tokenIn = ETH;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: AddressZero as Address,
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['USDC-1']),
      amountInMinor: 100,
      memo: '',
      excludedVenues: [],
    };
    await expect(() =>
      createPayloadV1(sender, tokenIn, invoice, mainnet, undefined, undefined),
    ).toThrowError('ETH payments are not supported in the V1 router.');
  });
});

describe('createPayloadV2', () => {
  test('correctly determines `payWithToken` payload', async () => {
    const tokenIn = USDT;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: AddressZero as Address,
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['USDT-1', 'USDC-1']),
      amountInMinor: 100,
      memo: '',
      excludedVenues: [],
    };
    const payload = createPayload(
      sender,
      tokenIn,
      invoice,
      mainnet,
      undefined,
      undefined,
    );

    expect(payload.contractFunctionName).toBe('payWithToken');
    expect(payload.contractArgs.length).toBe(7);
    expect(payload.contractArgs).toStrictEqual([
      stringToHex('', { size: 32 }),
      10n ** BigInt(USDT.decimals),
      [AddressZero, AddressZero],
      USDT.address,
      receiver,
      AddressZero,
      0,
    ]);
    expect(payload.value).toBe(0n);
    expect(payload.isSwap).toBe(false);
  });

  test('correctly determines `payWithToken` payload for ETH payment with price feed and memo', async () => {
    const tokenIn = ETH;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: AddressZero as Address,
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['ETH-1']),
      amountInMinor: 100,
      memo: 'asdf',
      excludedVenues: [],
    };
    const priceFeedDetails = {
      feedAddresses: [AddressZero, padAddress('1')],
      approximateRate: 190000000000n,
      convertedAmount: 526315700000000n,
    } as PriceFeedDetails;
    const payload = createPayload(
      sender,
      tokenIn,
      invoice,
      mainnet,
      undefined,
      undefined,
      false,
      priceFeedDetails,
    );

    expect(payload.contractFunctionName).toBe('payWithToken');
    expect(payload.contractArgs.length).toBe(7);
    expect(payload.contractArgs).toStrictEqual([
      stringToHex('asdf', { size: 32 }),
      // invoice amount in terms of token decimals
      10n ** BigInt(ETH.decimals),
      [AddressZero, padAddress('1')],
      ETH.address,
      receiver,
      AddressZero,
      0,
    ]);
    expect(payload.value).toBe(526315700000000n);
    expect(payload.isSwap).toBe(false);
  });

  test('correctly determines `payWithUniswap` payload for single hop', async () => {
    const tokenIn = WETH;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: AddressZero,
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['USDC-1']),
      amountInMinor: 250,
      memo: '',
    } as Invoice;
    const swapQuote = {
      path: [
        {
          poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
          tokenIn: WETH.address,
          tokenOut: USDC.address,
          poolFee: '500',
          amountIn: 10000000000000000n,
          amountOut: 2500000n,
        },
      ],
      amountIn: 10000000000000000n,
      amountOut: 2500000n,
    } as Quote;
    const swapVenue = SwapVenue.UNISWAP;
    const payload = createPayload(
      sender,
      tokenIn,
      invoice,
      mainnet,
      swapQuote,
      swapVenue,
    );

    expect(payload.contractFunctionName).toBe('payWithUniswap');
    expect(payload.contractArgs.length).toBe(1);
    expect(payload.value).toBe(0n);
    expect(payload.isSwap).toBe(true);

    const swapStruct = payload.contractArgs[0];
    expect(swapStruct.amountIn).toBe(10000000000000000n);
    const path = decodeAbiParameters(
      parseAbiParameters('address, uint24, address') as any,
      swapStruct.path,
    );
    expect(path).toStrictEqual([USDC.address, 500, WETH.address]);
    expect(swapStruct.receiver).toBe(receiver);
    expect(swapStruct.amountOut).toStrictEqual(2500000n);
    expect(swapStruct.memo).toBe(stringToHex('', { size: 32 }));
    expect(swapStruct.priceFeeds).toStrictEqual([AddressZero, AddressZero]);
    expect(swapStruct.extraFeeReceiver).toBe(AddressZero);
    expect(swapStruct.extraFeeBps).toBe(0);
    expect(swapStruct.returnRemainder).toBe(false);
    expect(swapStruct.swapType).toBe(0);
  });

  test('correctly determines `payWithUniswap` payload for multihop and memo and return remainder', async () => {
    const tokenIn = HEX;
    const invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: AddressZero,
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['FTM-1']),
      amountInMinor: 250,
      memo: 'asdf',
    } as Invoice;
    const swapQuoteMulti = {
      path: [
        {
          poolAddress: '0x82743c07BF3Be4d55876F87bca6cce5F84429bD0',
          tokenIn: FTM.address,
          tokenOut: WETH.address,
          poolFee: '10000',
          amountIn: 100000000n,
          amountOut: 10000000000000000n,
        },
        {
          poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
          tokenIn: WETH.address,
          tokenOut: USDC.address,
          poolFee: '3000',
          amountIn: 10000000000000000n,
          amountOut: 2500000n,
        },
      ],
      amountIn: 100000000n,
      amountOut: 2500000n,
    } as Quote;
    const swapVenueMulti = SwapVenue.UNISWAP;
    const payload = createPayload(
      sender,
      tokenIn,
      invoice,
      mainnet,
      swapQuoteMulti,
      swapVenueMulti,
      true,
      undefined,
    );

    expect(payload.contractFunctionName).toBe('payWithUniswap');
    expect(payload.contractArgs.length).toBe(1);
    expect(payload.value).toBe(0n);
    expect(payload.isSwap).toBe(true);

    const swapStruct = payload.contractArgs[0];
    expect(swapStruct.amountIn).toStrictEqual(100000000n);
    const pathTwo = decodeAbiParameters(
      parseAbiParameters('address, uint24, address, uint24, address') as any,
      swapStruct.path,
    );
    expect(pathTwo).toStrictEqual([
      USDC.address,
      3000,
      WETH.address,
      10000,
      FTM.address,
    ]);
    expect(swapStruct.sender).toBe(sender);
    expect(swapStruct.receiver).toBe(receiver);
    expect(swapStruct.amountOut).toStrictEqual(2500000n);
    expect(swapStruct.memo).toBe(stringToHex('asdf', { size: 32 }));
    expect(swapStruct.priceFeeds).toStrictEqual([AddressZero, AddressZero]);
    expect(swapStruct.extraFeeReceiver).toBe(AddressZero);
    expect(swapStruct.extraFeeBps).toBe(0);
    expect(swapStruct.returnRemainder).toBe(true);
    expect(swapStruct.swapType).toBe(1);
  });

  test('correctly determines `payWithUniswap` payload for ETH payment with one price feed', async () => {
    const tokenIn = ETH;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: AddressZero,
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['EURe-1']),
      amountInMinor: 100,
      memo: '',
    } as Invoice;
    const swapQuote = {
      path: [
        {
          poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
          // we wrap the eth in `payWithUniswap` so tokenIn is correct to be WETH
          tokenIn: WETH.address,
          tokenOut: EURe.address,
          poolFee: '500',
          amountIn: 526315700000000n,
          amountOut: 900000000000000000n,
        },
      ],
      amountIn: 526315700000000n,
      amountOut: 900000000000000000n,
    } as Quote;
    const swapVenue = SwapVenue.UNISWAP;
    const priceFeedDetails = {
      feedAddresses: [AddressZero, padAddress('1')],
      approximateRate: 90000000n,
      convertedAmount: 100000000n,
    } as PriceFeedDetails;
    const payload = createPayload(
      sender,
      tokenIn,
      invoice,
      mainnet,
      swapQuote,
      swapVenue,
      false,
      priceFeedDetails,
    );

    expect(payload.contractFunctionName).toBe('payWithUniswap');
    expect(payload.contractArgs.length).toBe(1);
    expect(payload.value).toBe(526315700000000n);
    expect(payload.isSwap).toBe(true);

    const swapStruct = payload.contractArgs[0];
    expect(swapStruct.amountIn).toBe(526315700000000n);
    const path = decodeAbiParameters(
      parseAbiParameters('address, uint24, address') as any,
      swapStruct.path,
    );
    expect(path).toStrictEqual([
      EURe.address,
      500,
      // We will convert from ETH to WETH in the contract
      ETH.address,
    ]);
    expect(swapStruct.receiver).toBe(receiver);
    expect(swapStruct.amountOut).toStrictEqual(1000000000000000000n);
    expect(swapStruct.memo).toBe(stringToHex('', { size: 32 }));
    expect(swapStruct.priceFeeds).toStrictEqual([AddressZero, padAddress('1')]);
    expect(swapStruct.extraFeeReceiver).toBe(AddressZero);
    expect(swapStruct.extraFeeBps).toBe(0);
    expect(swapStruct.returnRemainder).toBe(false);
    expect(swapStruct.swapType).toBe(0);
  });

  test('correctly determines `payWithUniswap` payload with two price feeds', async () => {
    const tokenIn = WETH;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'GBP',
      extraFeeAddress: AddressZero,
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['WETH-1']),
      amountInMinor: 45,
      memo: '',
    } as Invoice;
    const swapQuote = {
      path: [
        {
          poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
          tokenIn: WETH.address,
          tokenOut: EURe.address,
          poolFee: '500',
          amountIn: 526315700000000n,
          amountOut: 90000000n,
        },
      ],
      amountIn: 526315700000000n,
      amountOut: 90000000n,
    } as Quote;
    const swapVenue = SwapVenue.UNISWAP;
    const priceFeedDetails = {
      feedAddresses: [padAddress('1'), padAddress('2')],
      approximateRate: 50000000n,
      convertedAmount: 45000000n,
    } as PriceFeedDetails;
    const payload = createPayload(
      sender,
      tokenIn,
      invoice,
      mainnet,
      swapQuote,
      swapVenue,
      false,
      priceFeedDetails,
    );

    expect(payload.contractFunctionName).toBe('payWithUniswap');
    expect(payload.contractArgs.length).toBe(1);
    expect(payload.value).toBe(0n);
    expect(payload.isSwap).toBe(true);

    const swapStruct = payload.contractArgs[0];
    expect(swapStruct.amountIn).toBe(526315700000000n);
    const path = decodeAbiParameters(
      parseAbiParameters('address, uint24, address') as any,
      swapStruct.path,
    );
    expect(path).toStrictEqual([EURe.address, 500, WETH.address]);
    expect(swapStruct.receiver).toBe(receiver);
    // 0.45GBP with WETH decimals
    expect(swapStruct.amountOut).toStrictEqual(450000000000000000n);
    expect(swapStruct.memo).toBe(stringToHex('', { size: 32 }));
    expect(swapStruct.priceFeeds).toStrictEqual([
      padAddress('1'),
      padAddress('2'),
    ]);
    expect(swapStruct.extraFeeReceiver).toBe(AddressZero);
    expect(swapStruct.extraFeeBps).toBe(0);
    expect(swapStruct.returnRemainder).toBe(false);
    expect(swapStruct.swapType).toBe(0);
  });

  test('correctly determines `payWithCurve` payload', async () => {
    const tokenIn = WETH;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: padAddress('0'),
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['USDC-1']),
      amountInMinor: 100,
      memo: '',
      excludedVenues: [],
    };
    const swapQuote = {
      path: [
        {
          poolAddress: '0xd51a44d3fae010294c616388b506acda1bfaae46',
          tokenIn: WETH.address,
          tokenOut: USDC.address,
          poolFee: '',
          amountIn: 526315700000000n,
          amountOut: 1000000n,
          swapParams: [2, 0, 1],
          factoryAddress: AddressZero,
        },
      ],
      amountIn: 526315700000000n,
      amountOut: 1000000n,
    } as Quote;
    const swapVenue = SwapVenue.CURVE;
    const payload = createPayload(
      sender,
      tokenIn,
      invoice,
      mainnet,
      swapQuote,
      swapVenue,
    );

    expect(payload.contractFunctionName).toBe('payWithCurve');
    expect(payload.contractArgs.length).toBe(1);
    expect(payload.value).toBe(0n);
    expect(payload.isSwap).toBe(true);

    expect(payload.contractArgs[0]).toStrictEqual({
      sender,
      receiver,
      amountIn: 526315700000000n,
      amountOut: 1000000n,
      memo: stringToHex('', { size: 32 }),
      route: [
        WETH.address,
        '0xd51a44d3fae010294c616388b506acda1bfaae46',
        USDC.address,
        AddressZero,
        AddressZero,
        AddressZero,
        AddressZero,
        AddressZero,
        AddressZero,
      ],
      swapParams: [
        [2, 0, 1],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      factoryAddresses: [AddressZero, AddressZero, AddressZero, AddressZero],
      priceFeeds: [AddressZero, AddressZero],
      extraFeeReceiver: padAddress('0'),
      extraFeeBps: 0,
      returnRemainder: false,
    });
  });

  test('correctly determines `payWithCurve` payload for multihop', async () => {
    const tokenIn = WETH;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'USD',
      extraFeeAddress: padAddress('0'),
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['USDC-1']),
      amountInMinor: 100,
      memo: '',
      excludedVenues: [],
    };
    const swapQuote = {
      path: [
        {
          poolAddress: '0xd51a44d3fae010294c616388b506acda1bfaae46',
          tokenIn: WETH.address,
          tokenOut: USDT.address,
          poolFee: '',
          amountIn: 526315700000000n,
          amountOut: 1000000n,
          swapParams: [2, 0, 1],
          factoryAddress: AddressZero,
        },
        {
          poolAddress: '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7',
          tokenIn: USDT.address,
          tokenOut: USDC.address,
          poolFee: '',
          amountIn: 1000000n,
          amountOut: 1000000n,
          swapParams: [2, 1, 1],
          factoryAddress: AddressZero,
        },
      ],
      amountIn: 526315700000000n,
      amountOut: 1000000n,
    } as Quote;
    const swapVenue = SwapVenue.CURVE;
    const payload = createPayload(
      sender,
      tokenIn,
      invoice,
      mainnet,
      swapQuote,
      swapVenue,
    );

    expect(payload.contractFunctionName).toBe('payWithCurve');
    expect(payload.contractArgs.length).toBe(1);
    expect(payload.value).toBe(0n);
    expect(payload.isSwap).toBe(true);

    expect(payload.contractArgs[0]).toStrictEqual({
      sender,
      receiver,
      amountIn: 526315700000000n,
      amountOut: 1000000n,
      memo: stringToHex('', { size: 32 }),
      route: [
        WETH.address,
        '0xd51a44d3fae010294c616388b506acda1bfaae46',
        USDT.address,
        '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7',
        USDC.address,
        AddressZero,
        AddressZero,
        AddressZero,
        AddressZero,
      ],
      swapParams: [
        [2, 0, 1],
        [2, 1, 1],
        [0, 0, 0],
        [0, 0, 0],
      ],
      factoryAddresses: [AddressZero, AddressZero, AddressZero, AddressZero],
      priceFeeds: [AddressZero, AddressZero],
      extraFeeReceiver: padAddress('0'),
      extraFeeBps: 0,
      returnRemainder: false,
    });
  });

  test('correctly determines `payWithCurve` payload for ETH payment with one price feed and memo and return remainder', async () => {
    const tokenIn = ETH;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'EUR',
      extraFeeAddress: padAddress('0'),
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['USDC-1']),
      amountInMinor: 90,
      memo: 'asdf',
      excludedVenues: [],
    };
    const swapQuote = {
      path: [
        {
          poolAddress: '0xd51a44d3fae010294c616388b506acda1bfaae46',
          tokenIn: ETH.address,
          tokenOut: USDC.address,
          poolFee: '',
          amountIn: 526315700000000n,
          amountOut: 100000000n,
          swapParams: [2, 0, 1],
          factoryAddress: AddressZero,
        },
      ],
      amountIn: 526315700000000n,
      amountOut: 1000000n,
    } as Quote;
    const swapVenue = SwapVenue.CURVE;
    const priceFeedDetails = {
      feedAddresses: [padAddress('1'), AddressZero],
      approximateRate: 90000000n,
      convertedAmount: 90000000n,
    } as PriceFeedDetails;
    const payload = createPayload(
      sender,
      tokenIn,
      invoice,
      mainnet,
      swapQuote,
      swapVenue,
      true,
      priceFeedDetails,
    );

    expect(payload.contractFunctionName).toBe('payWithCurve');
    expect(payload.contractArgs.length).toBe(1);
    expect(payload.value).toBe(526315700000000n);
    expect(payload.isSwap).toBe(true);

    // route[0] should be WETH not ETH
    expect(payload.contractArgs[0]).toStrictEqual({
      sender,
      receiver,
      amountIn: 526315700000000n,
      amountOut: 900000n,
      memo: stringToHex('asdf', { size: 32 }),
      route: [
        WETH.address,
        '0xd51a44d3fae010294c616388b506acda1bfaae46',
        USDC.address,
        AddressZero,
        AddressZero,
        AddressZero,
        AddressZero,
        AddressZero,
        AddressZero,
      ],
      swapParams: [
        [2, 0, 1],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      factoryAddresses: [AddressZero, AddressZero, AddressZero, AddressZero],
      priceFeeds: [padAddress('1'), AddressZero],
      extraFeeReceiver: padAddress('0'),
      extraFeeBps: 0,
      returnRemainder: true,
    });
  });

  test('correctly determines `payWithCurve` payload with two price feeds', async () => {
    const tokenIn = WETH;
    const invoice: Invoice = {
      recipientAddress: receiver,
      currency: 'GBP',
      extraFeeAddress: padAddress('0'),
      extraFeeBps: 0,
      coins: coinIdsToCoinConfig(['USDC-1']),
      amountInMinor: 100,
      memo: '',
      excludedVenues: [],
    };
    const swapQuote = {
      path: [
        {
          poolAddress: '0x0',
          tokenIn: WETH.address,
          tokenOut: EURe.address,
          poolFee: '',
          amountIn: 526315700000000n,
          amountOut: 900000000000000000n,
          swapParams: [2, 0, 1],
          factoryAddress: AddressZero,
        },
      ],
      amountIn: 526315700000000n,
      amountOut: 900000000000000000n,
    } as Quote;
    const swapVenue = SwapVenue.CURVE;
    const priceFeedDetails = {
      feedAddresses: [padAddress('1'), padAddress('2')],
      approximateRate: 50000000n,
      convertedAmount: 450000000000000000n,
    } as PriceFeedDetails;
    const payload = createPayload(
      sender,
      tokenIn,
      invoice,
      mainnet,
      swapQuote,
      swapVenue,
      false,
      priceFeedDetails,
    );

    expect(payload.contractFunctionName).toBe('payWithCurve');
    expect(payload.contractArgs.length).toBe(1);
    expect(payload.value).toBe(0n);
    expect(payload.isSwap).toBe(true);

    expect(payload.contractArgs[0]).toStrictEqual({
      sender,
      receiver,
      amountIn: 526315700000000n,
      amountOut: 1000000000000000000n,
      memo: stringToHex('', { size: 32 }),
      route: [
        WETH.address,
        '0x0',
        EURe.address,
        AddressZero,
        AddressZero,
        AddressZero,
        AddressZero,
        AddressZero,
        AddressZero,
      ],
      swapParams: [
        [2, 0, 1],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      factoryAddresses: [AddressZero, AddressZero, AddressZero, AddressZero],
      priceFeeds: [padAddress('1'), padAddress('2')],
      extraFeeReceiver: padAddress('0'),
      extraFeeBps: 0,
      returnRemainder: false,
    });
  });
});
