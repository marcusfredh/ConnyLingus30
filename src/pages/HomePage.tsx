import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { usePoints } from '../context/usePoints'
import { useProfiles } from '../context/useProfiles'
import { useAdmin } from '../context/useAdmin'

interface TeamMeta {
  id: number
  name: string
}

const POINT_TYPE_LABELS: Record<string, string> = {
  beer_tasting_complete: 'Ölprovning klar',
  drink: 'drack en öl',
  drink_with_photo: 'drack med bild',
}

export function HomePage() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const { teamTotals = {}, events = [], loading: pointsLoading } = usePoints()
  const { nameOf } = useProfiles()
  const { isAdmin } = useAdmin()

  const [teams, setTeams] = useState<TeamMeta[]>([])
  const [teamsAssigned, setTeamsAssigned] = useState(false)
  const [teamsLoading, setTeamsLoading] = useState(true)

  useEffect(() => {
    if (!session) return

    async function load() {
      const [{ data: tData }, { data: pData }] = await Promise.all([
        supabase.from('teams').select('id, name').order('id'),
        supabase.from('profiles').select('team_id').limit(10),
      ])
      setTeams((tData ?? []) as TeamMeta[])
      setTeamsAssigned((pData ?? []).some((p) => p.team_id != null))
      setTeamsLoading(false)
    }

    load()

    const channel = supabase
      .channel('homepage_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, async () => {
        const { data } = await supabase.from('teams').select('id, name').order('id')
        setTeams((data ?? []) as TeamMeta[])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, async () => {
        const { data } = await supabase.from('profiles').select('team_id').limit(10)
        setTeamsAssigned((data ?? []).some((p) => p.team_id != null))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session])

  const recentEvents = events.slice(0, 5)
  const isLoading = pointsLoading || teamsLoading
  const showTeams = !isLoading && teamsAssigned && teams.length > 0

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

        {/* Team score cards — only shown after admin has assigned teams */}
        {showTeams && (
          <div className="w-full max-w-sm space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {teams.map((team) => {
                const pts = teamTotals[team.id] ?? 0
                const isTeam1 = team.id === 1
                return (
                  <div
                    key={team.id}
                    className={`rounded-2xl px-4 py-4 border ${
                      isTeam1
                        ? 'bg-gradient-to-br from-indigo-900/40 to-indigo-800/10 border-indigo-700/50'
                        : 'bg-gradient-to-br from-rose-900/40 to-rose-800/10 border-rose-700/50'
                    }`}
                  >
                    <p className={`text-xs font-semibold uppercase tracking-widest mb-1 truncate ${isTeam1 ? 'text-indigo-400' : 'text-rose-400'}`}>
                      {team.name}
                    </p>
                    <p className={`text-4xl font-black tabular-nums ${isTeam1 ? 'text-indigo-300' : 'text-rose-300'}`}>
                      {pts}
                    </p>
                    <p className={`text-xs font-normal ${isTeam1 ? 'text-indigo-500' : 'text-rose-500'}`}>poäng</p>
                  </div>
                )
              })}
            </div>

            {/* Activity feed */}
            {recentEvents.length > 0 && (
              <div className="bg-gray-900/60 border border-gray-800 rounded-2xl px-4 py-3 space-y-1.5">
                {recentEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-gray-400 truncate">
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
        )}

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
            onClick={() => navigate('/leaderboard')}
            className="w-full bg-gray-800 border border-gray-700 shadow-sm rounded-2xl px-5 py-4 flex items-center gap-4 active:bg-gray-700 transition"
          >
            <span className="text-3xl">🏆</span>
            <div className="text-left">
              <p className="font-semibold text-gray-50">Topplista</p>
              <p className="text-sm text-gray-400">Individuella poäng &amp; lag</p>
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
            onClick={() => navigate('/bars')}
            className="w-full bg-gray-800 border border-gray-700 shadow-sm rounded-2xl px-5 py-4 flex items-center gap-4 active:bg-gray-700 transition"
          >
            <span className="text-3xl">🍻</span>
            <div className="text-left">
              <p className="font-semibold text-gray-50">Barer i Göteborg</p>
              <p className="text-sm text-gray-400">Hitta ställen &amp; rösta</p>
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

          {/* Admin link — only visible to admins */}
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full bg-gray-800 border border-gray-700 shadow-sm rounded-2xl px-5 py-4 flex items-center gap-4 active:bg-gray-700 transition"
            >
              <span className="text-3xl">⚙️</span>
              <div className="text-left">
                <p className="font-semibold text-gray-50">Admin</p>
                <p className="text-sm text-gray-400">Tilldela lag</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </main>

    </div>
  )
}
