import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePoints } from '../context/usePoints'
import { useProfiles } from '../context/useProfiles'

const POINT_TYPE_LABELS: Record<string, string> = {
  beer_tasting_complete: 'Ölprovning klar',
  drink: 'drack en öl',
  drink_with_photo: 'drack med bild',
}

export function HomePage() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const { total, events, loading: pointsLoading } = usePoints()
  const { nameOf } = useProfiles()

  const recentEvents = events.slice(0, 5)

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">

      {/* Top bar */}
      <header className="flex items-center justify-between py-4">
        <p className="text-sm text-gray-400 truncate max-w-[70%]">
          {session?.user.email?.split('@')[0]}
        </p>
        <button
          onClick={signOut}
          className="text-sm font-medium text-indigo-400 active:text-indigo-300 transition"
        >
          Logga ut
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center text-center gap-5 py-4">
        <div className="text-5xl">🎂</div>
        <h1 className="text-3xl font-bold text-gray-50">
          Martin 30 år!
        </h1>

        {/* Team points card */}
        <div className="w-full max-w-sm bg-gradient-to-br from-amber-900/40 to-amber-800/20 border border-amber-700/50 rounded-2xl px-5 py-5">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-1">Lagets poäng</p>
          <p className="text-5xl font-black text-amber-400 tabular-nums">
            {pointsLoading ? '…' : total}
          </p>
          {/* Recent activity */}
          {recentEvents.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {recentEvents.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-amber-200/70 truncate">
                    {e.type === 'beer_tasting_complete'
                      ? POINT_TYPE_LABELS[e.type]
                      : `${nameOf(e.user_id)} ${POINT_TYPE_LABELS[e.type] ?? e.type}`}
                  </span>
                  <span className="text-amber-400 font-semibold shrink-0">+{e.points}p</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation cards */}
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => navigate('/drinks')}
            className="w-full bg-gray-800 border border-gray-700 shadow-sm rounded-2xl px-5 py-4 flex items-center gap-4 active:bg-gray-700 transition"
          >
            <span className="text-3xl">🍺</span>
            <div className="text-left">
              <p className="font-semibold text-gray-50">Dricka</p>
              <p className="text-sm text-gray-400">Registrera en enhet · 2–5p</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => navigate('/photos')}
            className="w-full bg-gray-800 border border-gray-700 shadow-sm rounded-2xl px-5 py-4 flex items-center gap-4 active:bg-gray-700 transition"
          >
            <span className="text-3xl">📸</span>
            <div className="text-left">
              <p className="font-semibold text-gray-50">Bilder</p>
              <p className="text-sm text-gray-400">Uppladdade drinkbilder</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => navigate('/beers')}
            className="w-full bg-gray-800 border border-gray-700 shadow-sm rounded-2xl px-5 py-4 flex items-center gap-4 active:bg-gray-700 transition"
          >
            <span className="text-3xl">🏅</span>
            <div className="text-left">
              <p className="font-semibold text-gray-50">Ölprovning</p>
              <p className="text-sm text-gray-400">Spike Brewery · 50p när alla klart</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => navigate('/schedule')}
            className="w-full bg-gray-800 border border-gray-700 shadow-sm rounded-2xl px-5 py-4 flex items-center gap-4 active:bg-gray-700 transition"
          >
            <span className="text-3xl">📅</span>
            <div className="text-left">
              <p className="font-semibold text-gray-50">Schema</p>
              <p className="text-sm text-gray-400">28–29 mars 2026</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => navigate('/bars')}
            className="w-full bg-gray-800 border border-gray-700 shadow-sm rounded-2xl px-5 py-4 flex items-center gap-4 active:bg-gray-700 transition"
          >
            <span className="text-3xl">🍻</span>
            <div className="text-left">
              <p className="font-semibold text-gray-50">Barer i Göteborg</p>
              <p className="text-sm text-gray-400">Hitta ställen & rösta</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </main>

    </div>
  )
}
