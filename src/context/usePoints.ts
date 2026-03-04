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

export function usePoints() {
  const [events, setEvents] = useState<PointEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('point_events')
        .select('*')
        .order('created_at', { ascending: false })

      const rows = (data ?? []) as PointEvent[]
      setEvents(rows)
      setTotal(rows.reduce((sum, e) => sum + e.points, 0))
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('point_events_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'point_events' }, (payload) => {
        const newEvent = payload.new as PointEvent
        setEvents((prev) => [newEvent, ...prev])
        setTotal((prev) => prev + newEvent.points)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return { total, events, loading }
}
