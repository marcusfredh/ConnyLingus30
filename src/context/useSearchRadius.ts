import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'bar_search_radius'
const DEFAULT_RADIUS = 5 // 5 km som standard
const MIN_RADIUS = 1 // 1 km
const MAX_RADIUS = 10 // 10 km

export function useSearchRadius() {
  const [radiusKm, setRadiusKmState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = parseFloat(stored)
        if (!isNaN(parsed) && parsed >= MIN_RADIUS && parsed <= MAX_RADIUS) {
          return parsed
        }
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_RADIUS
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, radiusKm.toString())
    } catch {
      // Ignore storage errors
    }
  }, [radiusKm])

  const setRadiusKm = useCallback((km: number) => {
    const clamped = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, km))
    setRadiusKmState(clamped)
  }, [])

  return {
    radiusKm,
    radiusMeters: radiusKm * 1000,
    setRadiusKm,
    minKm: MIN_RADIUS,
    maxKm: MAX_RADIUS,
    defaultKm: DEFAULT_RADIUS,
  }
}
