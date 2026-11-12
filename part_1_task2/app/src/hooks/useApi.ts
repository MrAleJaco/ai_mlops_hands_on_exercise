import { useQuery } from '@tanstack/react-query'
import { getJson, type ParamValue } from '../api/client'

/**
 * One wrapper for every endpoint: the query key is the path plus the exact
 * parameters, so changing a filter automatically refetches and going back to
 * a previous selection is instant (staleTime keeps it in cache).
 */
export function useApi<T>(path: string, params: Record<string, ParamValue> = {}, enabled = true) {
  return useQuery({
    queryKey: [path, params],
    queryFn: () => getJson<T>(path, params),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled,
  })
}
