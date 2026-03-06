import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfiles } from '../context/useProfiles'

interface DrinkPhoto {
  id: string
  user_id: string
  photo_url: string
  created_at: string
}

export function PhotosPage() {
  const navigate = useNavigate()
  const { nameOf } = useProfiles()

  const [photos, setPhotos] = useState<DrinkPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<DrinkPhoto | null>(null)

  // Swipe tracking
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('drinks')
        .select('id, user_id, photo_url, created_at')
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false })

      setPhotos((data ?? []) as DrinkPhoto[])
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('photos_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'drinks' }, (payload) => {
        const row = payload.new as DrinkPhoto
        if (row.photo_url) {
          setPhotos((prev) => [row, ...prev])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent, photo: DrinkPhoto) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null

    // Ignore if primarily vertical (scroll intent)
    if (Math.abs(dy) > Math.abs(dx)) return

    const SWIPE_THRESHOLD = 50
    if (Math.abs(dx) < SWIPE_THRESHOLD) {
      // Tap — close lightbox
      setLightbox(null)
      return
    }

    const idx = photos.findIndex((p) => p.id === photo.id)
    if (dx < 0 && idx > 0) {
      // Swipe left → newer photo (lower index)
      setLightbox(photos[idx - 1])
    } else if (dx > 0 && idx < photos.length - 1) {
      // Swipe right → older photo (higher index)
      setLightbox(photos[idx + 1])
    }
  }

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
          <h1 className="text-lg font-bold text-gray-50">Bilder</h1>
          <p className="text-xs text-gray-400">{loading ? '…' : `${photos.length} ${photos.length === 1 ? 'bild' : 'bilder'}`}</p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-2">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 gap-3 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm">Inga bilder ännu</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setLightbox(photo)}
                className="aspect-square overflow-hidden rounded-lg active:opacity-80 transition"
              >
                <img
                  src={photo.photo_url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={(e) => handleTouchEnd(e, lightbox)}
        >
          {/* Top bar — stopPropagation so tapping here doesn't close */}
          <div
            className="relative z-10 flex items-center justify-between px-4 py-4 pt-[calc(1rem+env(safe-area-inset-top))]"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-sm font-semibold text-white">{nameOf(lightbox.user_id)}</p>
              <p className="text-xs text-gray-400">
                {new Date(lightbox.created_at).toLocaleString('sv-SE', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
            <button
              onTouchEnd={(e) => { e.stopPropagation(); setLightbox(null) }}
              onClick={() => setLightbox(null)}
              className="text-gray-400 active:text-white p-2"
              aria-label="Stäng"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <img
              src={lightbox.photo_url}
              alt=""
              className="max-w-full max-h-full rounded-xl object-contain pointer-events-none"
            />
          </div>

          {/* Dot indicators */}
          {photos.length > 1 && (
            <div className="flex justify-center gap-1.5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-full transition-all ${
                    p.id === lightbox.id
                      ? 'w-2 h-2 bg-white'
                      : 'w-1.5 h-1.5 bg-white/30'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
