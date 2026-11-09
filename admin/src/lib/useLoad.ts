import { useCallback, useEffect, useRef, useState } from 'react'

import { errorMessage } from './format'

/** Runs an async loader on mount (and when `deps` change); exposes data, loading, error and reload(). */
export function useLoad<T>(loader: () => PromiseLike<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await loaderRef.current())
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    // Keep the previous data on screen (dimmed) while refetching — no layout jump.
    queueMicrotask(() => alive && setLoading(true))
    Promise.resolve(loaderRef.current())
      .then((d) => {
        if (alive) {
          setData(d)
          setError(null)
        }
      })
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, reload, setData }
}

/** Throws the Supabase error so useLoad can show it. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error
  return res.data as T
}
