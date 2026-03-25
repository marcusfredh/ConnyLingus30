import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useProfiles } from '../context/useProfiles'

interface Challenge {
  id: number
  text: string
  points: number
}

interface Completion {
  id: number
  challenge_id: number
  team_id: number | null
  completed_by: string
}

interface Profile {
  user_id: string
  team_id: number | null
}

export function ChallengesPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { nameOf } = useProfiles()

  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [myTeamId, setMyTeamId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<number | null>(null)
  const [undoing, setUndoing] = useState<number | null>(null)

  useEffect(() => {
    if (!session) return

    async function load() {
      const [{ data: cData }, { data: compData }, { data: pData }] = await Promise.all([
        supabase.from('challenges').select('id, text, points').order('created_at'),
        supabase.from('challenge_completions').select('id, challenge_id, team_id, completed_by'),
        supabase.from('profiles').select('user_id, team_id').eq('user_id', session!.user.id).single(),
      ])
      setChallenges((cData ?? []) as Challenge[])
      setCompletions((compData ?? []) as Completion[])
      setMyTeamId((pData as Profile | null)?.team_id ?? null)
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('challenges_page_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, async () => {
        const { data } = await supabase.from('challenges').select('id, text, points').order('created_at')
        setChallenges((data ?? []) as Challenge[])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_completions' }, async () => {
        const { data } = await supabase.from('challenge_completions').select('id, challenge_id, team_id, completed_by')
        setCompletions((data ?? []) as Completion[])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session])

  const handleComplete = async (challenge: Challenge) => {
    if (!session) return
    setCompleting(challenge.id)

    const { error: insertError } = await supabase
      .from('challenge_completions')
      .insert({ challenge_id: challenge.id, team_id: myTeamId ?? null, completed_by: session.user.id })

    if (!insertError) {
      await supabase.from('point_events').insert({
        type: 'challenge_complete',
        points: challenge.points,
        user_id: session.user.id,
        metadata: { challenge_id: challenge.id, challenge_text: challenge.text },
      })
      setCompletions((prev) => [
        ...prev,
        { id: Date.now(), challenge_id: challenge.id, team_id: myTeamId ?? null, completed_by: session.user.id },
      ])
    }

    setCompleting(null)
  }

  const handleUndo = async (challenge: Challenge) => {
    if (!session) return
    setUndoing(challenge.id)

    const comp =
      completions.find((c) => c.challenge_id === challenge.id && c.completed_by === session.user.id) ??
      completions.find((c) => c.challenge_id === challenge.id && (myTeamId != null ? c.team_id === myTeamId : c.team_id == null))

    if (comp) {
      const { error } = await supabase.from('challenge_completions').delete().eq('id', comp.id)
      if (!error) {
        // Hämta exakt en matchande point_event-rad och ta bort enbart den
        const { data: evtRows } = await supabase
          .from('point_events')
          .select('id')
          .eq('user_id', comp.completed_by)
          .eq('type', 'challenge_complete')
          .filter('metadata->>challenge_id', 'eq', String(challenge.id))
          .limit(1)

        if (evtRows && evtRows.length > 0) {
          await supabase.from('point_events').delete().eq('id', evtRows[0].id)
        }

        setCompletions((prev) => prev.filter((c) => c.id !== comp.id))
      }
    }

    setUndoing(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const myDoneIds = new Set(
    myTeamId != null
      ? completions.filter((c) => c.team_id === myTeamId).map((c) => c.challenge_id)
      : completions.filter((c) => c.completed_by === session?.user.id).map((c) => c.challenge_id)
  )

  const pending = challenges.filter((c) => !myDoneIds.has(c.id))
  const done = challenges.filter((c) => myDoneIds.has(c.id))
  const totalPoints = done.reduce((sum, c) => sum + c.points, 0)

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
        <h1 className="text-lg font-bold text-gray-50 flex-1">Utmaningar</h1>
        {done.length > 0 && (
          <span className="text-xs font-semibold text-amber-400 bg-amber-900/40 px-2.5 py-1 rounded-full">
            +{totalPoints}p klara
          </span>
        )}
      </header>

      <main className="flex-1 px-4 py-4 space-y-4">

        {challenges.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <p className="text-gray-400 text-sm">Inga utmaningar har lagts till ännu.</p>
          </div>
        )}

        {/* Pending challenges */}
        {pending.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
              Att göra · {pending.length}
            </h2>
            {pending.map((c) => {
              const allCompletions = completions.filter((comp) => comp.challenge_id === c.id)
              const otherTeamDone = myTeamId != null && allCompletions.some((comp) => comp.team_id != null && comp.team_id !== myTeamId)

              return (
                <div
                  key={c.id}
                  className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-4 flex items-start gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-100 leading-snug">{c.text}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-semibold text-amber-400 bg-amber-900/40 px-2 py-0.5 rounded-full">
                        {c.points} p
                      </span>
                      {otherTeamDone && (
                        <span className="text-xs text-gray-500 italic">Redan gjord av annat lag</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleComplete(c)}
                    disabled={completing === c.id}
                    className="flex-shrink-0 bg-amber-600 active:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl px-3 py-2 transition"
                  >
                    {completing === c.id ? (
                      <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : 'Klar!'}
                  </button>
                </div>
              )
            })}
          </section>
        )}

        {/* Completed challenges */}
        {done.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
              Klara · {done.length}
            </h2>
            {done.map((c) => {
              const comp = completions.find((co) =>
                co.challenge_id === c.id &&
                (myTeamId != null ? co.team_id === myTeamId : co.completed_by === session?.user.id)
              )
              const completedByName = comp ? nameOf(comp.completed_by) : null

              return (
                <div
                  key={c.id}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-4 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 leading-snug line-through decoration-gray-600">{c.text}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs font-semibold text-green-400 bg-green-900/40 px-2 py-0.5 rounded-full">
                        +{c.points} p
                      </span>
                      {completedByName && (
                        <span className="text-xs text-gray-500">av {completedByName}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUndo(c)}
                    disabled={undoing === c.id}
                    className="flex-shrink-0 w-8 h-8 rounded-full bg-green-900/50 border border-green-700/50 flex items-center justify-center active:bg-red-900/50 active:border-red-700/50 disabled:opacity-40 transition"
                    aria-label="Ångra"
                  >
                    {undoing === c.id ? (
                      <svg className="w-4 h-4 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </div>
              )
            })}
          </section>
        )}

      </main>
    </div>
  )
}
