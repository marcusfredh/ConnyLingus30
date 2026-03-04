import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function HomePage() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">

      {/* Top bar */}
      <header className="flex items-center justify-between py-4">
        <p className="text-sm text-gray-400 truncate max-w-[70%]">
          {session?.user.email}
        </p>
        <button
          onClick={signOut}
          className="text-sm font-medium text-indigo-400 active:text-indigo-300 transition"
        >
          Logga ut
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center text-center gap-6">
        <div className="text-6xl">🎂</div>
        <h1 className="text-3xl font-bold text-gray-50">
          Martin 30 år!
        </h1>

        {/* Navigation cards */}
        <div className="w-full max-w-sm space-y-3 mt-2">
          <button
            onClick={() => navigate('/beers')}
            className="w-full bg-gray-800 border border-gray-700 shadow-sm rounded-2xl px-5 py-4 flex items-center gap-4 active:bg-gray-700 transition"
          >
            <span className="text-3xl">🍺</span>
            <div className="text-left">
              <p className="font-semibold text-gray-50">Ölprovning</p>
              <p className="text-sm text-gray-400">Spike Brewery</p>
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
        </div>
      </main>

    </div>
  )
}
