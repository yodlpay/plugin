import { PricesResponse } from '@hiropay/common'

const BASE_URL = 'https://api.coingecko.com/api/v3'

/**
 * @param tokenIds CoinGecko ids as string
 * @param currencies currencies for which to get the token prices, invalid currencies won't show up
 */
export async function getPrices(tokenIds: string[], currencies: string[]) {
  const searchParams = new URLSearchParams({
    ids: tokenIds.join(','),
    vs_currencies: currencies.join(','),
  })
  const url = `${BASE_URL}/simple/price?${searchParams.toString()}`
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
    method: 'GET',
  })

  if (!res.ok) {
    throw new Error(
      `Failed to call '/simple/price' with status ${res.status} - ${res.statusText}`,
    )
  }

  return (await res.json()) as PricesResponse
}
