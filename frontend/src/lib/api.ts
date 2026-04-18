type TokenGetter = () => Promise<string | null>

let tokenGetter: TokenGetter | null = null

export function setTokenGetter(getter: TokenGetter) {
  tokenGetter = getter
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!tokenGetter) return {}
  const token = await tokenGetter()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function resolveUrl(path: string): string {
  if (path.startsWith('http')) return path
  const base =
    (typeof window !== 'undefined'
      ? (import.meta as Record<string, any>).env?.VITE_API_URL
      : process.env.VITE_API_URL) || ''
  return `${base}${path}`
}

export async function apiClient<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(resolveUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, text)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}
