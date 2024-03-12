// This utility function exists so that fetch can be easily be mocked
export const doFetch = (
  url: string,
  headers: RequestInit | undefined,
): Promise<Response> => {
  return fetch(url, headers)
}
