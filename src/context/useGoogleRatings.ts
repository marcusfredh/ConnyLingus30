import { useState, useCallback } from 'react'

const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

export interface PlaceRating {
  placeId: string
  rating: number
  userRatingsTotal: number
  priceLevel?: number
}

// Cache ratings in sessionStorage to minimize API calls
const CACHE_KEY = 'google_ratings_cache'

interface RatingsCache {
  [barId: string]: PlaceRating | null
}

function getCache(): RatingsCache {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    return cached ? JSON.parse(cached) : {}
  } catch {
    return {}
  }
}

function setCache(cache: RatingsCache) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore storage errors
  }
}

export function useGoogleRatings() {
  const [ratings, setRatings] = useState<RatingsCache>(getCache)
  const [loading, setLoading] = useState<Set<string>>(new Set())

  // Fetch rating for a single bar using Text Search
  const fetchRating = useCallback(async (barId: string, barName: string, lat: number, lng: number) => {
    // Check cache first
    if (ratings[barId] !== undefined) {
      return ratings[barId]
    }

    // Check if already loading
    if (loading.has(barId)) {
      return null
    }

    if (!API_KEY) {
      console.warn('Google Places API key not configured')
      return null
    }

    setLoading(prev => new Set(prev).add(barId))

    try {
      // Use Text Search API to find the place
      const searchQuery = `${barName} bar Göteborg`
      
      const response = await fetch(
        `https://places.googleapis.com/v1/places:searchText`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.id,places.rating,places.userRatingCount,places.priceLevel,places.location',
          },
          body: JSON.stringify({
            textQuery: searchQuery,
            locationBias: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius: 500, // 500 meters
              },
            },
            maxResultCount: 1,
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      
      let result: PlaceRating | null = null
      
      if (data.places && data.places.length > 0) {
        const place = data.places[0]
        if (place.rating) {
          result = {
            placeId: place.id,
            rating: place.rating,
            userRatingsTotal: place.userRatingCount || 0,
            priceLevel: place.priceLevel ? parsePriceLevel(place.priceLevel) : undefined,
          }
        }
      }

      // Update cache and state
      const newCache = { ...getCache(), [barId]: result }
      setCache(newCache)
      setRatings(newCache)

      return result
    } catch (err) {
      console.warn(`Failed to fetch rating for ${barName}:`, err)
      // Cache null to avoid retrying
      const newCache = { ...getCache(), [barId]: null }
      setCache(newCache)
      setRatings(newCache)
      return null
    } finally {
      setLoading(prev => {
        const next = new Set(prev)
        next.delete(barId)
        return next
      })
    }
  }, [ratings, loading])

  // Batch fetch ratings for multiple bars (respects rate limits)
  const fetchRatingsForBars = useCallback(async (
    bars: Array<{ id: string; name: string; lat: number; lng: number }>
  ) => {
    // Only fetch for bars not in cache
    const uncached = bars.filter(bar => ratings[bar.id] === undefined)
    
    // Limit to 10 at a time to stay within free tier
    const toFetch = uncached.slice(0, 10)
    
    // Fetch sequentially with small delay to respect rate limits
    for (const bar of toFetch) {
      await fetchRating(bar.id, bar.name, bar.lat, bar.lng)
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }, [ratings, fetchRating])

  const getRating = useCallback((barId: string): PlaceRating | null | undefined => {
    return ratings[barId]
  }, [ratings])

  const isLoading = useCallback((barId: string): boolean => {
    return loading.has(barId)
  }, [loading])

  return {
    ratings,
    getRating,
    isLoading,
    fetchRating,
    fetchRatingsForBars,
  }
}

function parsePriceLevel(priceLevel: string): number {
  // Google returns PRICE_LEVEL_FREE, PRICE_LEVEL_INEXPENSIVE, etc.
  const levels: Record<string, number> = {
    'PRICE_LEVEL_FREE': 0,
    'PRICE_LEVEL_INEXPENSIVE': 1,
    'PRICE_LEVEL_MODERATE': 2,
    'PRICE_LEVEL_EXPENSIVE': 3,
    'PRICE_LEVEL_VERY_EXPENSIVE': 4,
  }
  return levels[priceLevel] ?? 2
}
