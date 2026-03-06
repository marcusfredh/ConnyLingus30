import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { usePoints } from '../context/usePoints'
import { useAuth } from '../context/AuthContext'

interface Profile {
  user_id: string
  username: string
  team_id: number | null
}

interface TeamMeta {
  id: number
  name: string
}

export function LeaderboardPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { userTotals = {}, teamTotals = {}, loading: pointsLoading } = usePoints()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [teams, setTeams] = useState<TeamMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return

    async function load() {
      const [{ data: pData }, { data: tData }] = await Promise.all([
        supabase.from('profiles').select('user_id, username, team_id'),
        supabase.from('teams').select('id, name').order('id'),
      ])
      setProfiles((pData ?? []) as Profile[])
      setTeams((tData ?? []) as TeamMeta[])
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('leaderboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => {
        const { data } = await supabase.from('profiles').select('user_id, username, team_id')
        setProfiles((data ?? []) as Profile[])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, async () => {
        const { data } = await supabase.from('teams').select('id, name').order('id')
        setTeams((data ?? []) as TeamMeta[])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session])

  const teamsAssigned = profiles.some((p) => p.team_id != null)
  const teamName = (id: number | null) => teams.find((t) => t.id === id)?.name ?? null

  // Sort profiles by points descending
  const ranked = [...profiles].sort((a, b) => {
    const pa = userTotals[a.user_id] ?? 0
    const pb = userTotals[b.user_id] ?? 0
    return pb - pa
  })

  const isLoading = loading || pointsLoading

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
        <h1 className="text-lg font-bold text-gray-50 flex-1">Topplista</h1>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4">

        {/* Team totals — only shown when teams are assigned */}
        {teamsAssigned && teams.length > 0 && (
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
                  <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${isTeam1 ? 'text-indigo-400' : 'text-rose-400'}`}>
                    {team.name}
                  </p>
                  <p className={`text-3xl font-black tabular-nums ${isTeam1 ? 'text-indigo-300' : 'text-rose-300'}`}>
                    {isLoading ? '…' : pts}
                    <span className={`text-sm font-normal ml-1 ${isTeam1 ? 'text-indigo-500' : 'text-rose-500'}`}>p</span>
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Individual rankings */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center pt-12">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            ranked.map((profile, index) => {
              const pts = userTotals[profile.user_id] ?? 0
              const isMe = profile.user_id === session?.user.id
              const tid = profile.team_id
              const tname = teamName(tid)
              const isTeam1 = tid === 1
              const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null

              return (
                <div
                  key={profile.user_id}
                  className={`flex items-center gap-3 bg-gray-800 rounded-2xl px-4 py-3 border ${
                    isMe ? 'border-indigo-600' : 'border-gray-700'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center flex-shrink-0">
                    {medal ? (
                      <span className="text-xl">{medal}</span>
                    ) : (
                      <span className="text-sm font-bold text-gray-500">#{index + 1}</span>
                    )}
                  </div>

                  {/* Name + team badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-base truncate ${isMe ? 'text-indigo-300' : 'text-gray-50'}`}>
                        {profile.username}
                      </span>
                      {tname && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          isTeam1
                            ? 'bg-indigo-900/60 text-indigo-300'
                            : 'bg-rose-900/60 text-rose-300'
                        }`}>
                          {tname}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Points */}
                  <span className="text-lg font-bold text-amber-400 tabular-nums flex-shrink-0">
                    {pts}
                    <span className="text-xs font-normal text-amber-600 ml-0.5">p</span>
                  </span>
                </div>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}
