/**
 * Source `shipany-dir/src/lib/api-client.ts`, reduced to the four verbs the
 * console uses.
 *
 * The source's client unwraps a `{ code, message, data }` envelope and throws
 * `Error(message)` when `code !== 0`. This build's admin routes answer HTTP
 * status codes instead — `{ ok: true, … }` on success, and `createError({ data:
 * { message_en, message_zh } })` on refusal — so the same contract is
 * reproduced by translating the error payload into one `Error` whose message is
 * already in the reader's language. Every caller then does what the source's
 * callers do: `toast.error(e.message)`.
 */
export function useAdminApi() {
  const { isZh } = useLang()
  /**
   * `useRequestFetch`, not `$fetch`.
   *
   * During SSR a bare `$fetch` starts a *new* request that carries no cookies,
   * so the admin gate would answer 404 and every page would render its empty
   * state while looking perfectly healthy. `useRequestFetch` forwards the
   * incoming headers, which is what makes the server-rendered payload as
   * authorised as the browser's next click.
   */
  /**
   * `useRequestFetch`'s return type is keyed off the literal route table, so a
   * generic `<T>` cannot be threaded through it. The cast keeps the call site
   * typed (`api.get<{items: Row[]}>`) while the transport stays the request-aware
   * fetch — the alternative is `any` leaking into every page.
   */
  const request = useRequestFetch() as unknown as <R>(
    url: string,
    options?: { method?: string; body?: unknown },
  ) => Promise<R>

  function reason(error: unknown): string {
    const err = error as { data?: { data?: Record<string, unknown>; message?: string }; statusMessage?: string; message?: string }
    const payload = (err?.data?.data ?? err?.data ?? {}) as Record<string, unknown>
    const localized = isZh.value ? payload.message_zh : payload.message_en
    return (
      String(localized || '') ||
      String(err?.data?.message || '') ||
      String(err?.statusMessage || '') ||
      String(err?.message || '') ||
      (isZh.value ? '请求失败' : 'Request failed')
    )
  }

  async function send<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<T> {
    try {
      return await request<T>(url, { method, body })
    } catch (error) {
      throw new Error(reason(error))
    }
  }

  return {
    get: <T>(url: string) => send<T>('GET', url),
    post: <T>(url: string, body?: unknown) => send<T>('POST', url, body),
    put: <T>(url: string, body?: unknown) => send<T>('PUT', url, body),
    patch: <T>(url: string, body?: unknown) => send<T>('PATCH', url, body),
    del: <T>(url: string) => send<T>('DELETE', url),
  }
}

/** `pageQuery` from the same source file: drop empty values, keep order stable. */
export function pageQuery(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}
