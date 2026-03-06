import type { Bar } from '../context/useBars'

interface BarDetailSheetProps {
  bar: Bar
  distance?: number
  voteCount: number
  hasVoted: boolean
  hasVisited: boolean
  onToggleVote: () => void
  onToggleVisited: () => void
  onClose: () => void
}

function formatType(type: Bar['type']): string {
  switch (type) {
    case 'pub': return 'Pub'
    case 'nightclub': return 'Nattklubb'
    case 'biergarten': return 'Ölträdgård'
    default: return 'Bar'
  }
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m bort`
  }
  return `${(meters / 1000).toFixed(1)} km bort`
}

export function BarDetailSheet({
  bar,
  distance,
  voteCount,
  hasVoted,
  hasVisited,
  onToggleVote,
  onToggleVisited,
  onClose,
}: BarDetailSheetProps) {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${bar.lat},${bar.lng}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-gray-900 border-t border-gray-700 rounded-t-3xl px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-gray-700 mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-50 truncate">{bar.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                {formatType(bar.type)}
              </span>
              {distance !== undefined && (
                <span className="text-xs text-amber-400 font-medium">
                  {formatDistance(distance)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 active:text-gray-400 p-1 -mr-1"
            aria-label="Stäng"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info rows */}
        <div className="space-y-3 mb-6">
          {/* Address */}
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-gray-300">{bar.address}</p>
          </div>

          {/* Phone */}
          {bar.phone && (
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <a href={`tel:${bar.phone}`} className="text-sm text-indigo-400 active:text-indigo-300">
                {bar.phone}
              </a>
            </div>
          )}

          {/* Website */}
          {bar.website && (
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <a
                href={bar.website.startsWith('http') ? bar.website : `https://${bar.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-400 active:text-indigo-300 truncate"
              >
                {bar.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </div>
          )}

          {/* Opening hours */}
          {bar.opening_hours && (
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-300">{bar.opening_hours}</p>
            </div>
          )}
        </div>

        {/* Vote count */}
        <div className="bg-gray-800 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🙋</span>
            <div>
              <p className="text-sm font-semibold text-gray-50">
                {voteCount} {voteCount === 1 ? 'person' : 'personer'} vill gå hit
              </p>
              <p className="text-xs text-gray-500">
                {hasVoted ? 'Du är med!' : 'Rösta om du vill gå hit'}
              </p>
            </div>
          </div>
        </div>

        {/* Visited status */}
        <button
          onClick={onToggleVisited}
          className={`w-full py-3 mb-4 font-semibold rounded-xl transition flex items-center justify-center gap-2 ${
            hasVisited
              ? 'bg-green-600 text-white active:bg-green-700'
              : 'bg-gray-800 border border-gray-700 text-gray-400 active:bg-gray-700'
          }`}
        >
          {hasVisited ? (
            <>
              <span className="text-lg">✓</span>
              Jag har varit här
            </>
          ) : (
            <>
              <span className="text-lg">○</span>
              Markera som besökt
            </>
          )}
        </button>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onToggleVote}
            className={`flex-1 py-3.5 font-semibold rounded-xl transition ${
              hasVoted
                ? 'bg-indigo-600 text-white active:bg-indigo-700'
                : 'bg-gray-800 border border-gray-700 text-gray-50 active:bg-gray-700'
            }`}
          >
            {hasVoted ? '✓ Jag vill gå hit' : 'Jag vill gå hit'}
          </button>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl text-center active:bg-amber-600 transition"
          >
            Vägbeskrivning
          </a>
        </div>
      </div>
    </div>
  )
}
