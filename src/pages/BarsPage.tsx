import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useBars, calculateDistance, formatDistance } from '../context/useBars'
import type { Bar } from '../context/useBars'
import { useBarVotes } from '../context/useBarVotes'
import { useBarVisits } from '../context/useBarVisits'
import { useGoogleRatings } from '../context/useGoogleRatings'
import { useSearchRadius } from '../context/useSearchRadius'
import { usePaginatedBars } from '../context/usePaginatedBars'
import type { PlaceRating } from '../context/useGoogleRatings'
import { BarDetailSheet } from '../components/BarDetailSheet'
import { RadiusSelector } from '../components/RadiusSelector'

// Fix Leaflet default marker icon issue
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// Custom user location marker (blue dot)
const userIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#6366f1" stroke="#fff" stroke-width="3"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

// Custom bar marker (amber pin)
const barIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.164 0 0 7.164 0 16c0 12 16 24 16 24s16-12 16-24c0-8.836-7.164-16-16-16z" fill="#f59e0b"/>
      <circle cx="16" cy="14" r="6" fill="#fff"/>
    </svg>
  `),
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
})

// Gothenburg center
const GOTHENBURG_CENTER: [number, number] = [57.7089, 11.9746]

type ViewMode = 'list' | 'map'
type SortBy = 'votes' | 'rating' | 'distance' | 'name'

interface UserLocation {
  lat: number
  lng: number
}

// Component to recenter map when user location changes
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 14)
  }, [center, map])
  return null
}

// Parse OSM opening_hours to check if currently open (simplified parser)
function parseOpenStatus(openingHours: string | undefined): 'open' | 'closed' | 'unknown' {
  if (!openingHours) return 'unknown'
  
  // Very simplified parser - handles common formats like "Mo-Fr 16:00-01:00; Sa-Su 14:00-01:00"
  const now = new Date()
  const currentDay = now.getDay() // 0=Sun, 1=Mon, ...
  const currentTime = now.getHours() * 60 + now.getMinutes() // minutes since midnight
  
  const dayMap: Record<string, number[]> = {
    'mo': [1], 'tu': [2], 'we': [3], 'th': [4], 'fr': [5], 'sa': [6], 'su': [0],
    'mo-fr': [1, 2, 3, 4, 5], 'mo-sa': [1, 2, 3, 4, 5, 6], 'mo-su': [0, 1, 2, 3, 4, 5, 6],
    'sa-su': [0, 6], 'fr-sa': [5, 6], 'th-sa': [4, 5, 6],
  }
  
  try {
    const rules = openingHours.toLowerCase().split(';').map(s => s.trim())
    
    for (const rule of rules) {
      // Match patterns like "mo-fr 16:00-01:00" or "sa 14:00-02:00"
      const match = rule.match(/^([a-z-]+)\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/)
      if (!match) continue
      
      const [, dayRange, startH, startM, endH, endM] = match
      const days = dayMap[dayRange]
      if (!days || !days.includes(currentDay)) continue
      
      const startTime = parseInt(startH) * 60 + parseInt(startM)
      let endTime = parseInt(endH) * 60 + parseInt(endM)
      
      // Handle overnight hours (e.g., 16:00-01:00)
      if (endTime < startTime) {
        // Either we're in the evening part or the morning part
        if (currentTime >= startTime || currentTime < endTime) {
          return 'open'
        }
      } else {
        if (currentTime >= startTime && currentTime < endTime) {
          return 'open'
        }
      }
    }
    
    // If we have rules but none matched, it's closed
    return 'closed'
  } catch {
    return 'unknown'
  }
}

// Format type label in Swedish
function formatTypeLabel(type: Bar['type']): string {
  switch (type) {
    case 'pub': return 'Pub'
    case 'nightclub': return 'Klubb'
    case 'biergarten': return 'Ölträdgård'
    default: return 'Bar'
  }
}

function BarListItem({
  bar,
  distance,
  voteCount,
  hasVoted,
  hasVisited,
  rating,
  ratingLoading,
  onClick,
}: {
  bar: Bar
  distance?: number
  voteCount: number
  hasVoted: boolean
  hasVisited: boolean
  rating?: PlaceRating | null
  ratingLoading?: boolean
  onClick: () => void
}) {
  const typeEmoji: Record<Bar['type'], string> = {
    bar: '🍸',
    pub: '🍺',
    nightclub: '🪩',
    biergarten: '🍻',
  }

  const openStatus = parseOpenStatus(bar.opening_hours)
  const hasWebsite = !!bar.website
  const hasPhone = !!bar.phone

  return (
    <button
      onClick={onClick}
      className={`w-full bg-gray-800 border rounded-xl px-4 py-3 flex items-center gap-3 active:bg-gray-700 transition text-left ${
        hasVisited ? 'border-green-600/50' : 'border-gray-700'
      }`}
    >
      <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center text-2xl shrink-0 relative">
        {typeEmoji[bar.type]}
        {hasVisited && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center text-white text-xs">
            ✓
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-50 font-medium truncate">{bar.name}</p>
          {rating && (
            <span className="flex items-center gap-0.5 text-xs bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded-md shrink-0">
              ⭐ {rating.rating.toFixed(1)}
              <span className="text-amber-600 text-[10px]">({rating.userRatingsTotal})</span>
            </span>
          )}
          {ratingLoading && (
            <span className="w-3 h-3 border-2 border-gray-600 border-t-amber-400 rounded-full animate-spin shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">{formatTypeLabel(bar.type)}</span>
          {openStatus === 'open' && (
            <span className="text-xs text-green-400 font-medium">• Öppet</span>
          )}
          {openStatus === 'closed' && (
            <span className="text-xs text-red-400">• Stängt</span>
          )}
          {hasWebsite && (
            <span className="text-xs text-gray-600">🌐</span>
          )}
          {hasPhone && (
            <span className="text-xs text-gray-600">📞</span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate mt-0.5">{bar.address}</p>
        {voteCount > 0 && (
          <p className="text-xs text-indigo-400 mt-0.5">
            🙋 {voteCount} vill gå hit {hasVoted && '(inkl. dig)'}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        {distance !== undefined ? (
          <p className="text-sm text-amber-400 font-semibold">{formatDistance(distance)}</p>
        ) : (
          <p className="text-xs text-gray-600">—</p>
        )}
      </div>
    </button>
  )
}

export function BarsPage() {
  const navigate = useNavigate()
  const { radiusKm } = useSearchRadius()
  const { getVoteCount, hasUserVoted, toggleVote } = useBarVotes()
  const { hasVisited, toggleVisited, visitedCount } = useBarVisits()
  const { getRating, isLoading: isRatingLoading, fetchRatingsForBars } = useGoogleRatings()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortBy, setSortBy] = useState<SortBy>('votes')
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [selectedBar, setSelectedBar] = useState<Bar | null>(null)

  // Request user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation stöds inte')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => {
        setLocationError('Kunde inte hämta position')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // Fetch bars based on user location and radius
  const { bars, loading, error } = useBars({ 
    userLocation, 
    radiusKm 
  })

  // Fetch Google ratings for visible bars (first 20)
  useEffect(() => {
    if (bars.length > 0 && viewMode === 'list') {
      // Fetch ratings for the first 20 bars to stay within free tier
      const barsToFetch = bars.slice(0, 20).map(bar => ({
        id: bar.id,
        name: bar.name,
        lat: bar.lat,
        lng: bar.lng,
      }))
      fetchRatingsForBars(barsToFetch)
    }
  }, [bars, viewMode, fetchRatingsForBars])

  // Calculate distances and sort bars
  const sortedBars = useMemo(() => {
    const barsWithDistance = bars.map((bar) => {
      const distance = userLocation
        ? calculateDistance(userLocation.lat, userLocation.lng, bar.lat, bar.lng)
        : undefined
      return { bar, distance }
    })

    // Sort based on selected sort option
    return barsWithDistance.sort((a, b) => {
      switch (sortBy) {
        case 'distance': {
          // Distance ascending (closest first)
          if (a.distance !== undefined && b.distance !== undefined) {
            return a.distance - b.distance
          }
          if (a.distance !== undefined) return -1
          if (b.distance !== undefined) return 1
          return a.bar.name.localeCompare(b.bar.name, 'sv')
        }
        case 'rating': {
          // Rating descending (highest first)
          const ratingA = getRating(a.bar.id)?.rating ?? 0
          const ratingB = getRating(b.bar.id)?.rating ?? 0
          if (ratingB !== ratingA) return ratingB - ratingA
          return a.bar.name.localeCompare(b.bar.name, 'sv')
        }
        case 'name': {
          // Alphabetical
          return a.bar.name.localeCompare(b.bar.name, 'sv')
        }
        case 'votes':
        default: {
          // Votes descending (most wanted first)
          const votesA = getVoteCount(a.bar.id)
          const votesB = getVoteCount(b.bar.id)
          if (votesB !== votesA) return votesB - votesA
          // Secondary: rating
          const ratingA = getRating(a.bar.id)?.rating ?? 0
          const ratingB = getRating(b.bar.id)?.rating ?? 0
          if (ratingB !== ratingA) return ratingB - ratingA
          return a.bar.name.localeCompare(b.bar.name, 'sv')
        }
      }
    })
  }, [bars, userLocation, getVoteCount, getRating, sortBy])

  // Apply pagination to sorted bars
  const { 
    items: paginatedBars, 
    hasMore, 
    loadMore, 
    totalCount, 
    loadedCount 
  } = usePaginatedBars(sortedBars, 20)

  const handleToggleVote = async () => {
    if (selectedBar) {
      await toggleVote(selectedBar.id)
    }
  }

  const handleToggleVisited = async () => {
    if (selectedBar) {
      await toggleVisited(selectedBar.id)
    }
  }

  const mapCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : GOTHENBURG_CENTER

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 bg-gray-900 border-b border-gray-700">
        <button
          onClick={() => navigate('/')}
          className="text-indigo-400 active:text-indigo-300 p-1 -ml-1"
          aria-label="Tillbaka"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-50">Barer i Göteborg</h1>
          <p className="text-xs text-gray-400">
            {loading ? 'Laddar...' : `${bars.length} ställen`}
            {visitedCount > 0 && ` · ${visitedCount} besökta`}
            {locationError && ' · Plats ej tillgänglig'}
          </p>
        </div>
        <div className="bg-amber-900/50 text-amber-400 text-sm font-semibold px-3 py-1 rounded-full">
          🍻
        </div>
      </header>

      {/* View mode toggle */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              viewMode === 'list'
                ? 'bg-gray-700 text-gray-50'
                : 'text-gray-400'
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              viewMode === 'map'
                ? 'bg-gray-700 text-gray-50'
                : 'text-gray-400'
            }`}
          >
            Karta
          </button>
        </div>

        {/* Sort options - only show in list view */}
        {viewMode === 'list' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sortera:</span>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setSortBy('votes')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                  sortBy === 'votes'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}
              >
                🙋 Populärast
              </button>
              <button
                onClick={() => setSortBy('rating')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                  sortBy === 'rating'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}
              >
                ⭐ Betyg
              </button>
              <button
                onClick={() => setSortBy('distance')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                  sortBy === 'distance'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}
                disabled={!userLocation}
                title={!userLocation ? 'Plats ej tillgänglig' : undefined}
              >
                📍 Avstånd
              </button>
              <button
                onClick={() => setSortBy('name')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                  sortBy === 'name'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}
              >
                A-Ö
              </button>
            </div>
          </div>
        )}

        {/* Radius selector */}
        <RadiusSelector className="bg-gray-800 rounded-xl px-3 py-2" />
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex justify-center items-center flex-1">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
            <p className="text-red-400 mb-2">Kunde inte ladda barer</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="flex-1 px-4 pb-4 space-y-2 overflow-y-auto">
            {/* Pagination info */}
            {totalCount > 0 && (
              <p className="text-xs text-gray-500 text-center py-1">
                Visar {loadedCount} av {totalCount} barer
              </p>
            )}
            
            {paginatedBars.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-24 gap-3 text-gray-600">
                <span className="text-4xl">🍺</span>
                <p className="text-sm">Inga barer hittades inom {radiusKm} km</p>
              </div>
            ) : (
              <>
                {paginatedBars.map(({ bar, distance }) => (
                  <BarListItem
                    key={bar.id}
                    bar={bar}
                    distance={distance}
                    voteCount={getVoteCount(bar.id)}
                    hasVoted={hasUserVoted(bar.id)}
                    hasVisited={hasVisited(bar.id)}
                    rating={getRating(bar.id)}
                    ratingLoading={isRatingLoading(bar.id)}
                    onClick={() => setSelectedBar(bar)}
                  />
                ))}
                
                {/* Load more button */}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    className="w-full py-3 text-sm font-medium text-indigo-400 bg-gray-800 rounded-xl border border-gray-700 hover:bg-gray-700 active:bg-gray-600 transition"
                  >
                    Ladda fler barer ({totalCount - loadedCount} kvar)
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 relative">
            <MapContainer
              center={mapCenter}
              zoom={14}
              className="w-full h-full"
              style={{ minHeight: '400px' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <RecenterMap center={mapCenter} />
              
              {/* User location marker */}
              {userLocation && (
                <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                  <Popup>Din position</Popup>
                </Marker>
              )}
              
              {/* Bar markers */}
              {bars.map((bar) => (
                <Marker
                  key={bar.id}
                  position={[bar.lat, bar.lng]}
                  icon={barIcon}
                  eventHandlers={{
                    click: () => setSelectedBar(bar),
                  }}
                >
                  <Popup>
                    <div className="text-center">
                      <p className="font-semibold">{bar.name}</p>
                      <p className="text-xs text-gray-600">{bar.address}</p>
                      {getVoteCount(bar.id) > 0 && (
                        <p className="text-xs text-indigo-600 mt-1">
                          🙋 {getVoteCount(bar.id)} vill gå hit
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
      </main>

      {/* Detail sheet */}
      {selectedBar && (
        <BarDetailSheet
          bar={selectedBar}
          distance={
            userLocation
              ? calculateDistance(userLocation.lat, userLocation.lng, selectedBar.lat, selectedBar.lng)
              : undefined
          }
          voteCount={getVoteCount(selectedBar.id)}
          hasVoted={hasUserVoted(selectedBar.id)}
          hasVisited={hasVisited(selectedBar.id)}
          onToggleVote={handleToggleVote}
          onToggleVisited={handleToggleVisited}
          onClose={() => setSelectedBar(null)}
        />
      )}
    </div>
  )
}
