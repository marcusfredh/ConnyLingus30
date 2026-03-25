import { useState, useMemo, useCallback, useEffect } from 'react'

const DEFAULT_PAGE_SIZE = 20

export function usePaginatedBars<T>(items: T[], pageSize: number = DEFAULT_PAGE_SIZE) {
  const [displayCount, setDisplayCount] = useState(pageSize)

  // Reset display count when items change significantly
  useEffect(() => {
    setDisplayCount(pageSize)
  }, [items.length, pageSize])

  const paginatedItems = useMemo(() => {
    return items.slice(0, displayCount)
  }, [items, displayCount])

  const hasMore = displayCount < items.length

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayCount((prev) => Math.min(prev + pageSize, items.length))
    }
  }, [hasMore, pageSize, items.length])

  const reset = useCallback(() => {
    setDisplayCount(pageSize)
  }, [pageSize])

  const loadAll = useCallback(() => {
    setDisplayCount(items.length)
  }, [items.length])

  return {
    items: paginatedItems,
    hasMore,
    loadMore,
    loadAll,
    reset,
    totalCount: items.length,
    loadedCount: paginatedItems.length,
    remainingCount: items.length - paginatedItems.length,
  }
}
