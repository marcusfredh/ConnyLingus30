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

  useEffect(() => {
    if (!session) return

    async function load() {
      const [{ data: pData }, { data: tData }] = await Promise.all([
        supabase.from('profiles').select('user_id, username, team_id').order('username'),
        supabase.from('teams').select('id, name').order('id'),
      ])
      setProfiles((pData ?? []) as Profile[])
      setTeams((tData ?? []) as Team[])
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

      </main>
    </div>
  )
}
