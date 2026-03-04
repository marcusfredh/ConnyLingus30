import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useAdmin } from '../context/useAdmin'

const BEERS = Array.from({ length: 5 }, (_, i) => i + 1)
const TOTAL_PLAYERS = 6
const TASTING_POINTS = 50

interface BeerRating {
  beer_number: number
  rating: number
  user_id: string
}

interface AverageRating {
  beer_number: number
  avg: number
  count: number
}

function computeAverages(ratings: BeerRating[]): Record<number, AverageRating> {
  const avgMap: Record<number, AverageRating> = {}
  for (const r of ratings) {
    if (!avgMap[r.beer_number]) {
      avgMap[r.beer_number] = { beer_number: r.beer_number, avg: 0, count: 0 }
    }
    avgMap[r.beer_number].avg += r.rating
    avgMap[r.beer_number].count += 1
  }
  for (const key in avgMap) {
    avgMap[key].avg = Math.round((avgMap[key].avg / avgMap[key].count) * 10) / 10
  }
  return avgMap
}

function RatingSlider({
  value,
  onChange,
  onCommit,
  saving,
}: {
  value: number | undefined
  onChange: (v: number) => void
  onCommit: (v: number) => void
  saving: boolean
}) {
  const displayValue = value ?? 5

  return (
    <div className="px-1">
      {/* Current value display */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">0</span>
        <div className="flex items-center gap-1.5">
          {saving ? (
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          ) : value !== undefined ? (
            <span className="text-2xl font-bold text-indigo-400 tabular-nums">{value}</span>
          ) : (
            <span className="text-sm text-gray-500">Dra för att betygsätta</span>
          )}
          {value !== undefined && !saving && (
            <span className="text-sm text-gray-500 font-normal">/10</span>
          )}
        </div>
        <span className="text-xs text-gray-500">10</span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={displayValue}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        className="w-full h-2 appearance-none rounded-full outline-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-7
          [&::-webkit-slider-thumb]:h-7
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-indigo-500
          [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-runnable-track]:rounded-full
        "
        style={{
          background: value !== undefined
            ? `linear-gradient(to right, #6366f1 0%, #6366f1 ${displayValue * 10}%, #374151 ${displayValue * 10}%, #374151 100%)`
            : '#374151',
        }}
      />
    </div>
  )
}

export function BeerRatingPage() {
  const { session } = useAuth()
  const { isAdmin } = useAdmin()
  const navigate = useNavigate()
  const userId = session!.user.id

  const [myRatings, setMyRatings] = useState<Record<number, number>>({})
  const [averages, setAverages] = useState<Record<number, AverageRating>>({})
  const [pendingRatings, setPendingRatings] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)

  // Beer names
  const [beerNames, setBeerNames] = useState<Record<number, string>>({})
  const [editingBeer, setEditingBeer] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingName, setSavingName] = useState(false)

  const allRatingsRef = useRef<BeerRating[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [{ data: mine }, { data: all }, { data: names }] = await Promise.all([
        supabase.from('beer_ratings').select('beer_number, rating').eq('user_id', userId),
        supabase.from('beer_ratings').select('beer_number, rating, user_id'),
        supabase.from('beer_names').select('beer_number, name'),
      ])

      const myMap: Record<number, number> = {}
      for (const r of mine ?? []) myMap[r.beer_number] = r.rating
      setMyRatings(myMap)
      setPendingRatings(myMap)

      allRatingsRef.current = (all ?? []) as BeerRating[]
      setAverages(computeAverages(allRatingsRef.current))

      const namesMap: Record<number, string> = {}
      for (const n of names ?? []) namesMap[n.beer_number] = n.name
      setBeerNames(namesMap)

      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('beer_ratings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beer_ratings' }, (payload) => {
        const updated = payload.new as BeerRating
        const existing = allRatingsRef.current.findIndex(
          (r) => r.beer_number === updated.beer_number && r.user_id === updated.user_id
        )
        if (existing >= 0) {
          allRatingsRef.current[existing] = updated
        } else {
          allRatingsRef.current = [...allRatingsRef.current, updated]
        }
        setAverages(computeAverages(allRatingsRef.current))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beer_names' }, (payload) => {
        const updated = payload.new as { beer_number: number; name: string }
        setBeerNames((prev) => ({ ...prev, [updated.beer_number]: updated.name }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const handleRate = async (beerNumber: number, rating: number) => {
    setSaving((s) => ({ ...s, [beerNumber]: true }))

    const { error } = await supabase
      .from('beer_ratings')
      .upsert(
        { beer_number: beerNumber, user_id: userId, rating },
        { onConflict: 'beer_number,user_id' }
      )

    if (!error) {
      setMyRatings((prev) => ({ ...prev, [beerNumber]: rating }))
      setPendingRatings((prev) => ({ ...prev, [beerNumber]: rating }))

      // Update the local ratings ref immediately so the average reflects
      // the change without waiting for the realtime event to arrive.
      const existing = allRatingsRef.current.findIndex(
        (r) => r.beer_number === beerNumber && r.user_id === userId
      )
      if (existing >= 0) {
        allRatingsRef.current = allRatingsRef.current.map((r, i) =>
          i === existing ? { ...r, rating } : r
        )
      } else {
        allRatingsRef.current = [...allRatingsRef.current, { beer_number: beerNumber, rating, user_id: userId }]
      }
      setAverages(computeAverages(allRatingsRef.current))

      // Check if all TOTAL_PLAYERS have rated all BEERS — if so, award tasting points once.
      // Count unique (user_id, beer_number) pairs.
      const uniquePairs = new Set(allRatingsRef.current.map((r) => `${r.user_id}|${r.beer_number}`))
      const allDone = uniquePairs.size >= TOTAL_PLAYERS * BEERS.length

      if (allDone) {
        // Only insert if no beer_tasting_complete event exists yet.
        const { data: existing_event } = await supabase
          .from('point_events')
          .select('id')
          .eq('type', 'beer_tasting_complete')
          .maybeSingle()

        if (!existing_event) {
          await supabase.from('point_events').insert({
            type: 'beer_tasting_complete',
            points: TASTING_POINTS,
            user_id: userId,
            metadata: null,
          })
        }
      }
    }

    setSaving((s) => ({ ...s, [beerNumber]: false }))
  }

  const startEditingName = (beerNumber: number) => {
    setEditingBeer(beerNumber)
    setEditingName(beerNames[beerNumber] ?? `Öl ${beerNumber}`)
  }

  const saveName = async (beerNumber: number) => {
    if (!editingName.trim()) return
    setSavingName(true)
    await supabase
      .from('beer_names')
      .upsert({ beer_number: beerNumber, name: editingName.trim() }, { onConflict: 'beer_number' })
    setBeerNames((prev) => ({ ...prev, [beerNumber]: editingName.trim() }))
    setSavingName(false)
    setEditingBeer(null)
  }

  const ratedCount = BEERS.filter((n) => myRatings[n] !== undefined).length

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
          <h1 className="text-lg font-bold text-gray-50">Ölprovning</h1>
          <p className="text-xs text-gray-400">Spike Brewery</p>
        </div>
        {/* Progress badge */}
        <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
          ratedCount === BEERS.length
            ? 'bg-green-900/50 text-green-400'
            : 'bg-indigo-900/50 text-indigo-400'
        }`}>
          {ratedCount}/{BEERS.length}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center pt-12">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          BEERS.map((beerNumber) => {
            const myRating = myRatings[beerNumber]
            const pending = pendingRatings[beerNumber]
            const avg = averages[beerNumber]
            const isSaving = saving[beerNumber]
            const isRated = myRating !== undefined
            const isEditing = editingBeer === beerNumber
            const beerName = beerNames[beerNumber] ?? `Öl ${beerNumber}`

            return (
              <div
                key={beerNumber}
                className={`bg-gray-800 rounded-2xl border shadow-sm px-4 py-4 transition ${
                  isRated ? 'border-indigo-700' : 'border-gray-700'
                }`}
              >
                {/* Beer name row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Rated indicator */}
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      isRated ? 'bg-indigo-600' : 'bg-gray-600'
                    }`}>
                      {isRated ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-xs font-bold text-gray-400">{beerNumber}</span>
                      )}
                    </div>

                    {/* Name / edit */}
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveName(beerNumber)
                            if (e.key === 'Escape') setEditingBeer(null)
                          }}
                          className="flex-1 text-base font-semibold text-gray-50 border-b-2 border-indigo-500 bg-transparent focus:outline-none py-0.5"
                        />
                        <button onClick={() => saveName(beerNumber)} disabled={savingName}
                          className="text-xs font-semibold text-indigo-400 active:text-indigo-300 disabled:opacity-50">
                          {savingName ? 'Sparar…' : 'Spara'}
                        </button>
                        <button onClick={() => setEditingBeer(null)}
                          className="text-xs font-medium text-gray-500 active:text-gray-400">
                          Avbryt
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h2 className="font-semibold text-gray-50 truncate">{beerName}</h2>
                        {isAdmin && (
                          <button onClick={() => startEditingName(beerNumber)}
                            className="flex-shrink-0 text-gray-600 active:text-indigo-400 transition" aria-label="Redigera namn">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0110 16H8v-2a2 2 0 01.586-1.414z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Average */}
                  {!isEditing && (
                    <div className="flex-shrink-0 text-right ml-2">
                      {avg ? (
                        <div>
                          <span className="text-base font-bold text-amber-400">{avg.avg}</span>
                          <span className="text-xs text-gray-500 ml-0.5">/10</span>
                          <p className="text-xs text-gray-500">{avg.count} {avg.count === 1 ? 'röst' : 'röster'}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Inga röster</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Slider */}
                <RatingSlider
                  value={pending}
                  onChange={(v) => setPendingRatings((prev) => ({ ...prev, [beerNumber]: v }))}
                  onCommit={(v) => handleRate(beerNumber, v)}
                  saving={isSaving}
                />
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}
