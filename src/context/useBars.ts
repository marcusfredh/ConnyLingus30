import { useEffect, useState, useCallback } from 'react'

export interface Bar {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  phone?: string
  website?: string
  opening_hours?: string
  type: 'bar' | 'pub' | 'nightclub' | 'biergarten'
}

// Gothenburg bounding box (roughly city center + surrounding areas)
const GOTHENBURG_BBOX = {
  south: 57.65,
  west: 11.85,
  north: 57.75,
  east: 12.05,
}

const CACHE_KEY = 'bars_cache'
const CACHE_DURATION_MS = 1000 * 60 * 60 // 1 hour

interface CacheData {
  bars: Bar[]
  timestamp: number
}

function getCache(): CacheData | null {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (!cached) return null
    const data: CacheData = JSON.parse(cached)
    if (Date.now() - data.timestamp > CACHE_DURATION_MS) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function setCache(bars: Bar[]) {
  try {
    const data: CacheData = { bars, timestamp: Date.now() }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors
  }
}

function parseOsmTags(tags: Record<string, string>): Partial<Bar> {
  const result: Partial<Bar> = {}
  
  if (tags.phone || tags['contact:phone']) {
    result.phone = tags.phone || tags['contact:phone']
  }
  if (tags.website || tags['contact:website']) {
    result.website = tags.website || tags['contact:website']
  }
  if (tags.opening_hours) {
    result.opening_hours = tags.opening_hours
  }
  
  // Build address from available parts
  const addressParts: string[] = []
  if (tags['addr:street']) {
    const street = tags['addr:housenumber'] 
      ? `${tags['addr:street']} ${tags['addr:housenumber']}`
      : tags['addr:street']
    addressParts.push(street)
  }
  if (tags['addr:city']) {
    addressParts.push(tags['addr:city'])
  }
  if (addressParts.length > 0) {
    result.address = addressParts.join(', ')
  }
  
  return result
}

function mapAmenityToType(amenity: string): Bar['type'] {
  switch (amenity) {
    case 'pub': return 'pub'
    case 'nightclub': return 'nightclub'
    case 'biergarten': return 'biergarten'
    default: return 'bar'
  }
}

export function useBars() {
  const [bars, setBars] = useState<Bar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBars = useCallback(async () => {
    // Check cache first
    const cached = getCache()
    if (cached) {
      setBars(cached.bars)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Overpass QL query for bars, pubs, nightclubs, biergartens in Gothenburg
    // Using a more compact query with regex and longer timeout
    const bbox = `${GOTHENBURG_BBOX.south},${GOTHENBURG_BBOX.west},${GOTHENBURG_BBOX.north},${GOTHENBURG_BBOX.east}`
    const query = `
      [out:json][timeout:90];
      nwr["amenity"~"^(bar|pub|nightclub|biergarten)$"](${bbox});
      out center;
    `

    // Multiple Overpass API endpoints to try
    const endpoints = [
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass-api.de/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ]

    let lastError: Error | null = null

    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

        const response = await fetch(endpoint, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        
        const fetchedBars: Bar[] = data.elements
          .filter((el: { tags?: { name?: string } }) => el.tags?.name) // Only include named venues
          .map((el: { 
            id: number
            lat?: number
            lon?: number
            center?: { lat: number; lon: number }
            tags: Record<string, string>
          }) => {
            const lat = el.lat ?? el.center?.lat ?? 0
            const lng = el.lon ?? el.center?.lon ?? 0
            const parsedTags = parseOsmTags(el.tags)
            
            return {
              id: `osm_${el.id}`,
              name: el.tags.name,
              address: parsedTags.address || 'Göteborg',
              lat,
              lng,
              phone: parsedTags.phone,
              website: parsedTags.website,
              opening_hours: parsedTags.opening_hours,
              type: mapAmenityToType(el.tags.amenity),
            } as Bar
          })

        setBars(fetchedBars)
        setCache(fetchedBars)
        setLoading(false)
        return // Success, exit early
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error')
        console.warn(`Overpass endpoint ${endpoint} failed:`, lastError.message)
        // Continue to next endpoint
      }
    }

    // All endpoints failed
    setError(lastError?.message || 'Kunde inte ansluta till OpenStreetMap')
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchBars()
  }, [fetchBars])

  return { bars, loading, error, refetch: fetchBars }
}

// Helper: Calculate distance between two coordinates using Haversine formula
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

// Format distance for display
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}
