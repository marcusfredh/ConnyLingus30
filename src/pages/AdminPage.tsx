import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAdmin } from '../context/useAdmin'
import { useAuth } from '../context/AuthContext'

interface Profile {
  user_id: string
  username: string
  team_id: number | null
}

interface Team {
  id: number
  name: string
}

interface Challenge {
  id: number
  text: string
  points: number
  created_at: string
}

export function AdminPage() {
  const { isAdmin, loading: adminLoading } = useAdmin()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [editingTeam, setEditingTeam] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Challenges
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [challengeText, setChallengeText] = useState('')
  const [challengePoints, setChallengePoints] = useState('')
  const [savingChallenge, setSavingChallenge] = useState(false)
  const [challengeError, setChallengeError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    if (!session) return

    async function load() {
      const [{ data: pData }, { data: tData }, { data: cData }] = await Promise.all([
        supabase.from('profiles').select('user_id, username, team_id').order('username'),
        supabase.from('teams').select('id, name').order('id'),
        supabase.from('challenges').select('id, text, points, created_at').order('created_at', { ascending: false }),
      ])
      setProfiles((pData ?? []) as Profile[])
      setTeams((tData ?? []) as Team[])
      setChallenges((cData ?? []) as Challenge[])
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('admin_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => {
        const { data } = await supabase.from('profiles').select('user_id, username, team_id').order('username')
        setProfiles((data ?? []) as Profile[])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, async () => {
        const { data } = await supabase.from('teams').select('id, name').order('id')
        setTeams((data ?? []) as Team[])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, async () => {
        const { data } = await supabase.from('challenges').select('id, text, points, created_at').order('created_at', { ascending: false })
        setChallenges((data ?? []) as Challenge[])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session])

  const teamsAssigned = profiles.some((p) => p.team_id != null)

  const handleAssignTeams = async () => {
    setAssigning(true)
    const shuffled = [...profiles].sort(() => Math.random() - 0.5)
    const half = Math.ceil(shuffled.length / 2)
    const updates = shuffled.map((p, i) => ({
      user_id: p.user_id,
      team_id: i < half ? 1 : 2,
    }))

    for (const u of updates) {
      await supabase.from('profiles').update({ team_id: u.team_id }).eq('user_id', u.user_id)
    }

    // Refresh profiles locally
    const { data } = await supabase.from('profiles').select('user_id, username, team_id').order('username')
    setProfiles((data ?? []) as Profile[])
    setAssigning(false)
  }

  const handleClearTeams = async () => {
    setAssigning(true)
    for (const p of profiles) {
      await supabase.from('profiles').update({ team_id: null }).eq('user_id', p.user_id)
    }
    const { data } = await supabase.from('profiles').select('user_id, username, team_id').order('username')
    setProfiles((data ?? []) as Profile[])
    setAssigning(false)
  }

  const startEditName = (team: Team) => {
    setEditingTeam(team.id)
    setEditingName(team.name)
  }

  const saveName = async (teamId: number) => {
    if (!editingName.trim()) return
    setSavingName(true)
    await supabase.from('teams').update({ name: editingName.trim() }).eq('id', teamId)
    setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, name: editingName.trim() } : t))
    setSavingName(false)
    setEditingTeam(null)
  }

  const handleAddChallenge = async (e: React.FormEvent) => {
    e.preventDefault()
    setChallengeError('')
    const trimmedText = challengeText.trim()
    const pts = parseInt(challengePoints, 10)
    if (!trimmedText) { setChallengeError('Ange en beskrivning.'); return }
    if (!challengePoints || isNaN(pts) || pts <= 0) { setChallengeError('Ange ett giltigt antal poäng (> 0).'); return }
    setSavingChallenge(true)
    const { data, error } = await supabase.from('challenges').insert({ text: trimmedText, points: pts }).select().single()
    setSavingChallenge(false)
    if (error || !data) { setChallengeError('Kunde inte spara utmaningen.'); return }
    setChallenges((prev) => [data as Challenge, ...prev])
    setChallengeText('')
    setChallengePoints('')
  }

  const handleDeleteChallenge = async (id: number) => {
    setDeletingId(id)
    const { error } = await supabase.from('challenges').delete().eq('id', id)
    setDeletingId(null)
    if (!error) setChallenges((prev) => prev.filter((c) => c.id !== id))
  }

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <p className="text-gray-400 text-center">Åtkomst nekad.</p>
      </div>
    )
  }

  const team1 = profiles.filter((p) => p.team_id === 1)
  const team2 = profiles.filter((p) => p.team_id === 2)
  const unassigned = profiles.filter((p) => p.team_id == null)

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
        <h1 className="text-lg font-bold text-gray-50 flex-1">Admin</h1>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4">

        {/* Team assignment buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleAssignTeams}
            disabled={assigning}
            className="flex-1 bg-indigo-600 active:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-2xl py-3 text-sm transition"
          >
            {assigning ? 'Tilldelar…' : teamsAssigned ? 'Tilldela om lag' : 'Tilldela lag slumpmässigt'}
          </button>
          {teamsAssigned && (
            <button
              onClick={handleClearTeams}
              disabled={assigning}
              className="bg-gray-700 active:bg-gray-600 disabled:opacity-50 text-gray-300 font-semibold rounded-2xl px-4 py-3 text-sm transition"
            >
              Rensa
            </button>
          )}
        </div>

        {/* Team cards */}
        {teams.map((team) => {
          const members = team.id === 1 ? team1 : team2
          const isEditing = editingTeam === team.id
          const colorClasses = {
            border: team.id === 1 ? 'border-indigo-700/50' : 'border-rose-700/50',
            bg: team.id === 1 ? 'from-indigo-900/30 to-indigo-800/10' : 'from-rose-900/30 to-rose-800/10',
            badge: team.id === 1 ? 'bg-indigo-900/60 text-indigo-300' : 'bg-rose-900/60 text-rose-300',
            label: team.id === 1 ? 'text-indigo-400' : 'text-rose-400',
          }

          return (
            <div
              key={team.id}
              className={`bg-gradient-to-br ${colorClasses.bg} border ${colorClasses.border} rounded-2xl px-4 py-4`}
            >
              {/* Team name row */}
              <div className="flex items-center gap-2 mb-3">
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName(team.id)
                        if (e.key === 'Escape') setEditingTeam(null)
                      }}
                      className="flex-1 text-base font-bold text-gray-50 border-b-2 border-indigo-500 bg-transparent focus:outline-none py-0.5"
                    />
                    <button
                      onClick={() => saveName(team.id)}
                      disabled={savingName}
                      className="text-xs font-semibold text-indigo-400 active:text-indigo-300 disabled:opacity-50"
                    >
                      {savingName ? 'Sparar…' : 'Spara'}
                    </button>
                    <button
                      onClick={() => setEditingTeam(null)}
                      className="text-xs font-medium text-gray-500 active:text-gray-400"
                    >
                      Avbryt
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className={`text-base font-bold flex-1 ${colorClasses.label}`}>{team.name}</h2>
                    <button
                      onClick={() => startEditName(team)}
                      className="text-gray-600 active:text-indigo-400 transition"
                      aria-label="Byt namn"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0110 16H8v-2a2 2 0 01.586-1.414z" />
                      </svg>
                    </button>
                  </>
                )}
              </div>

              {/* Members */}
              {members.length === 0 ? (
                <p className="text-xs text-gray-500 italic">Inga medlemmar ännu</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {members.map((p) => (
                    <span key={p.user_id} className={`text-sm font-medium px-3 py-1 rounded-full ${colorClasses.badge}`}>
                      {p.username}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Unassigned */}
        {unassigned.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Ej tilldelade</h2>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((p) => (
                <span key={p.user_id} className="text-sm font-medium px-3 py-1 rounded-full bg-gray-700 text-gray-300">
                  {p.username}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Challenges */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-4 space-y-4">
          <h2 className="text-base font-bold text-amber-400">Utmaningar</h2>

          {/* Add challenge form */}
          <form onSubmit={handleAddChallenge} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Beskrivning</label>
              <textarea
                value={challengeText}
                onChange={(e) => setChallengeText(e.target.value)}
                placeholder="Beskriv utmaningen…"
                rows={2}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-50 placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Poäng</label>
              <input
                type="number"
                min={1}
                value={challengePoints}
                onChange={(e) => setChallengePoints(e.target.value)}
                placeholder="t.ex. 10"
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-50 placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            {challengeError && (
              <p className="text-xs text-red-400">{challengeError}</p>
            )}
            <button
              type="submit"
              disabled={savingChallenge}
              className="w-full bg-amber-600 active:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-2xl py-3 text-sm transition"
            >
              {savingChallenge ? 'Sparar…' : 'Lägg till utmaning'}
            </button>
          </form>

          {/* Existing challenges list */}
          {challenges.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-700">
              {challenges.map((c) => (
                <div key={c.id} className="flex items-start gap-3 bg-gray-700/50 rounded-xl px-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-100 leading-snug">{c.text}</p>
                    <span className="inline-block mt-1 text-xs font-semibold text-amber-400 bg-amber-900/40 px-2 py-0.5 rounded-full">
                      {c.points} p
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteChallenge(c.id)}
                    disabled={deletingId === c.id}
                    className="flex-shrink-0 text-gray-600 active:text-red-400 disabled:opacity-40 transition mt-0.5"
                    aria-label="Ta bort"
                  >
                    {deletingId === c.id ? (
                      <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 01-1-1V5a1 1 0 011-1h6a1 1 0 011 1v1a1 1 0 01-1 1H9z" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {challenges.length === 0 && (
            <p className="text-xs text-gray-500 italic">Inga utmaningar tillagda ännu.</p>
          )}
        </div>

      </main>
    </div>
  )
}
