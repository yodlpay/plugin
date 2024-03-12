import { TokenInfo } from '@yodlpay/tokenlists'
import { createHttpServer } from '../components/__tests__/utils/helpers'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { AddressZero } from '@hiropay/common'
import { UniswapV3PoolResponse } from '@hiropay/common'

export function uniswapV3Response(
  amountIn: string,
  amountOut: string,
  tokenPath: TokenInfo[],
  poolPath: string[],
  poolFees: number[],
) {
  const response = {
    route: [[] as UniswapV3PoolResponse[]],
  }

  for (let i = 0; i < poolPath.length; i++) {
    const pool = {
      type: 'v3-pool',
      address: poolPath[i],
      tokenIn: tokenPath[i],
      tokenOut: tokenPath[i + 1],
      fee: poolFees[i].toString(),
    } as UniswapV3PoolResponse
    if (i == 0) {
      pool.amountIn = amountIn
    }
    if (i == poolPath.length - 1) {
      pool.amountOut = amountOut
    }
    response.route[0].push(pool)
  }
  return response
}

export async function curveResponseProvider(
  returnValues: [string, bigint][],
  shouldReturnChainId: boolean = true,
) {
  const shared = { reqNo: 0 }
  const server = await createHttpServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/json',
    })
    if (shouldReturnChainId && shared.reqNo === 0) {
      // eth_getChainId
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x1' }))
    } else if (shared.reqNo <= returnValues.length) {
      // index value for if we have returned the chainId
      let returnValueIndex = shared.reqNo - 1
      if (!shouldReturnChainId) {
        returnValueIndex = shared.reqNo
      }
      const [address, amountOut] = returnValues[returnValueIndex]
      const addressHex = address.substring(2).padStart(64, '0')
      const amountOutHex = amountOut.toString(16).padStart(64, '0')
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: '0x' + addressHex + amountOutHex,
        }),
      )
    } else {
      // Shouldn't get here
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x0' }))
    }
    shared.reqNo += 1
  })
  return createPublicClient({
    chain: mainnet,
    transport: http(server.url),
  })
}

export function curveClientResponse(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountOut: string,
) {
  return {
    output: amountOut.toString(),
    route: [
      {
        inputCoinAddress: tokenInAddress,
        outputCoinAddress: tokenOutAddress,
        // These values do not get used by our function
        i: 2,
        j: 0,
        poolAddress: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
        poolId: 'tri-crypto',
        swapAddress: AddressZero,
        swapType: 1,
      },
    ],
  }
}
