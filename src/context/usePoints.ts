import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface PointEvent {
  id: string
  type: string
  points: number
  user_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface UserPoints {
  user_id: string
  total: number
}

export interface TeamPoints {
  team_id: number
  total: number
}

export function usePoints() {
  const [events, setEvents] = useState<PointEvent[]>([])
  const [userTotals, setUserTotals] = useState<Record<string, number>>({})
  const [teamTotals, setTeamTotals] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  function computeUserTotals(evts: PointEvent[]): Record<string, number> {
    const map: Record<string, number> = {}
    for (const e of evts) {
      map[e.user_id] = (map[e.user_id] ?? 0) + e.points
    }
    return map
  }

  async function computeTeamTotals(
    utotals: Record<string, number>
  ): Promise<Record<number, number>> {
    const { data } = await supabase.from('profiles').select('user_id, team_id')
    const map: Record<number, number> = {}
    for (const p of data ?? []) {
      if (p.team_id == null) continue
      map[p.team_id] = (map[p.team_id] ?? 0) + (utotals[p.user_id] ?? 0)
    }
    return map
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('point_events')
        .select('*')
        .order('created_at', { ascending: false })

      const rows = (data ?? []) as PointEvent[]
      setEvents(rows)
      const ut = computeUserTotals(rows)
      setUserTotals(ut)
      setTeamTotals(await computeTeamTotals(ut))
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('point_events_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'point_events' }, async (payload) => {
        const newEvent = payload.new as PointEvent
        setEvents((prev) => {
          const updated = [newEvent, ...prev]
          const ut = computeUserTotals(updated)
          setUserTotals(ut)
          computeTeamTotals(ut).then(setTeamTotals)
          return updated
        })
      })
      // Recompute team totals if team assignments change
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, async () => {
        setUserTotals((ut) => {
          computeTeamTotals(ut).then(setTeamTotals)
          return ut
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Grand total across all users (for backwards compat)
  const total = Object.values(userTotals).reduce((s, v) => s + v, 0)

  return { total, events, userTotals, teamTotals, loading }
}
