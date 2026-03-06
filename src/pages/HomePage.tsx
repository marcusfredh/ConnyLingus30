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
  challenge_complete: 'klarade en utmaning',
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
      <header className="flex items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎂</span>
          <p className="text-sm font-bold text-gray-50">Martin 30 år!</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-500 truncate max-w-[100px]">
            {session?.user.email?.split('@')[0]}
          </p>
          <button
            onClick={signOut}
            className="text-xs font-medium text-gray-500 active:text-gray-300 transition"
          >
            Logga ut
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center gap-4 py-3">

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

        {/* Navigation grid */}
        <div className="w-full max-w-sm grid grid-cols-2 gap-3">
          {[
            { icon: '⚡', label: 'Utmaningar', sub: 'Tävla lag mot lag', path: '/challenges' },
            { icon: '🍺', label: 'Dricka', sub: 'Registrera en enhet', path: '/drinks' },
            { icon: '🏆', label: 'Topplista', sub: 'Poäng & lag', path: '/leaderboard' },
            { icon: '📸', label: 'Bilder', sub: 'Drinkbilder', path: '/photos' },
            { icon: '🏅', label: 'Ölprovning', sub: 'Spike Brewery', path: '/beers' },
            { icon: '🍻', label: 'Barer', sub: 'Hitta ställen & rösta', path: '/bars' },
            { icon: '📅', label: 'Schema', sub: '28–29 mars', path: '/schedule' },
            ...(isAdmin ? [{ icon: '⚙️', label: 'Admin', sub: 'Tilldela lag', path: '/admin' }] : []),
          ].map(({ icon, label, sub, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-4 flex flex-col items-start gap-1 active:bg-gray-700 transition text-left"
            >
              <span className="text-2xl leading-none">{icon}</span>
              <p className="font-semibold text-gray-50 text-sm mt-1">{label}</p>
              <p className="text-xs text-gray-500 leading-snug">{sub}</p>
            </button>
          ))}
        </div>
      </main>

    </div>
  )
}
