import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

export interface BarVisit {
  id: string
  place_id: string
  user_id: string
  created_at: string
}

export function useBarVisits() {
  const { session } = useAuth()
  const userId = session?.user.id

  const [visits, setVisits] = useState<BarVisit[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch user's visits
  const fetchVisits = useCallback(async () => {
    if (!userId) {
      setVisits([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data } = await supabase
      .from('bar_visits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    setVisits((data ?? []) as BarVisit[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchVisits()

    if (!userId) return

    // Real-time subscription for current user's visits
    const channel = supabase
      .channel('bar_visits_changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'bar_visits',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        const newVisit = payload.new as BarVisit
        setVisits((prev) => [newVisit, ...prev])
      })
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'bar_visits',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        const oldVisit = payload.old as { id: string }
        setVisits((prev) => prev.filter((v) => v.id !== oldVisit.id))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchVisits, userId])

  // Check if user has visited a bar
  const hasVisited = useCallback(
    (placeId: string): boolean => {
      return visits.some((v) => v.place_id === placeId)
    },
    [visits]
  )

  // Get count of visited bars
  const visitedCount = visits.length

  // Mark bar as visited
  const markVisited = useCallback(
    async (placeId: string): Promise<boolean> => {
      if (!userId) return false

      const { error } = await supabase.from('bar_visits').insert({
        place_id: placeId,
        user_id: userId,
      })

      return !error
    },
    [userId]
  )

  // Remove visited mark
  const unmarkVisited = useCallback(
    async (placeId: string): Promise<boolean> => {
      if (!userId) return false

      const { error } = await supabase
        .from('bar_visits')
        .delete()
        .eq('place_id', placeId)
        .eq('user_id', userId)

      return !error
    },
    [userId]
  )

  // Toggle visited status
  const toggleVisited = useCallback(
    async (placeId: string): Promise<boolean> => {
      if (hasVisited(placeId)) {
        return unmarkVisited(placeId)
      } else {
        return markVisited(placeId)
      }
    },
    [hasVisited, markVisited, unmarkVisited]
  )

  return {
    visits,
    loading,
    visitedCount,
    hasVisited,
    markVisited,
    unmarkVisited,
    toggleVisited,
  }
}
