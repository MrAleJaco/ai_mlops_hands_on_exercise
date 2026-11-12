/** Thin fetch wrapper: one origin, JSON only, errors carry the API detail. */

export type ParamValue = string | number | boolean | null | undefined

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function toQuery(params: Record<string, ParamValue> = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function getJson<T>(path: string, params: Record<string, ParamValue> = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}${toQuery(params)}`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      // a non-JSON error page is still an error; keep the status text
    }
    throw new ApiError(response.status, detail)
  }

  return (await response.json()) as T
}
