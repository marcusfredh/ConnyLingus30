import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { usePoints } from '../context/usePoints'

const POINTS_NO_PHOTO = 2
const POINTS_WITH_PHOTO = 5

export function DrinkPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { total, events, loading: pointsLoading } = usePoints()
  const userId = session!.user.id

  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState<{ points: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setPhoto(file)
    if (file) {
      setPhotoPreview(URL.createObjectURL(file))
    } else {
      setPhotoPreview(null)
    }
  }

  const clearPhoto = () => {
    setPhoto(null)
    setPhotoPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleDrink = async () => {
    setSubmitting(true)

    let photoUrl: string | null = null

    if (photo) {
      const ext = photo.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('drink-photos')
        .upload(path, photo, { upsert: false })

      if (!uploadError) {
        const { data } = supabase.storage.from('drink-photos').getPublicUrl(path)
        photoUrl = data.publicUrl
      }
    }

    const points = photoUrl ? POINTS_WITH_PHOTO : POINTS_NO_PHOTO
    const type = photoUrl ? 'drink_with_photo' : 'drink'

    // Insert drink record
    await supabase.from('drinks').insert({ user_id: userId, photo_url: photoUrl })

    // Insert point event
    await supabase.from('point_events').insert({
      type,
      points,
      user_id: userId,
      metadata: photoUrl ? { photo_url: photoUrl } : null,
    })

    clearPhoto()
    setSubmitting(false)
    setFlash({ points })
    setTimeout(() => setFlash(null), 2500)
  }

  // Recent drink events for the feed
  const drinkEvents = events.filter((e) => e.type === 'drink' || e.type === 'drink_with_photo')

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
          <h1 className="text-lg font-bold text-gray-50">Dricka</h1>
          <p className="text-xs text-gray-400">Registrera en enhet</p>
        </div>
        {/* Team points badge */}
        <div className="bg-amber-900/50 text-amber-400 text-sm font-bold px-3 py-1 rounded-full">
          {pointsLoading ? '…' : total} p
        </div>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-6">

        {/* Points info */}
        <div className="flex gap-3">
          <div className="flex-1 bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-50">{POINTS_NO_PHOTO}p</p>
            <p className="text-xs text-gray-400 mt-0.5">utan bild</p>
          </div>
          <div className="flex-1 bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{POINTS_WITH_PHOTO}p</p>
            <p className="text-xs text-gray-400 mt-0.5">med bild</p>
          </div>
        </div>

        {/* Photo picker */}
        {photoPreview ? (
          <div className="relative rounded-2xl overflow-hidden border border-gray-700">
            <img src={photoPreview} alt="Förhandsvisning" className="w-full max-h-64 object-cover" />
            <button
              onClick={clearPhoto}
              className="absolute top-2 right-2 bg-gray-900/80 text-gray-300 rounded-full p-1.5 active:bg-gray-700"
              aria-label="Ta bort bild"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-700 rounded-2xl py-6 flex flex-col items-center gap-2 text-gray-500 active:border-indigo-500 active:text-indigo-400 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium">Lägg till bild (+{POINTS_WITH_PHOTO - POINTS_NO_PHOTO}p bonus)</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoChange}
        />

        {/* Main drink button */}
        <button
          onClick={handleDrink}
          disabled={submitting}
          className="w-full py-5 bg-amber-500 active:bg-amber-600 text-gray-950 font-bold text-xl rounded-2xl transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {submitting ? (
            <div className="w-6 h-6 border-3 border-gray-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="text-2xl">🍺</span>
              Jag dricker en öl!
            </>
          )}
        </button>

        {/* Flash message */}
        {flash && (
          <div className="bg-green-900/50 border border-green-700 text-green-400 font-semibold text-center rounded-2xl py-4 text-lg animate-pulse">
            +{flash.points} poäng till laget! 🎉
          </div>
        )}

        {/* Recent drinks feed */}
        {drinkEvents.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Senaste</h2>
            <div className="space-y-2">
              {drinkEvents.slice(0, 10).map((e) => (
                <div key={e.id} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
                  {e.type === 'drink_with_photo' && e.metadata?.photo_url ? (
                    <img
                      src={e.metadata.photo_url as string}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <span className="text-2xl shrink-0">🍺</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300">
                      {e.type === 'drink_with_photo' ? 'Drack med bild' : 'Drack en öl'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(e.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-amber-400">+{e.points}p</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
