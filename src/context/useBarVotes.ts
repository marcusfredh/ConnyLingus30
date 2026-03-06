import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

export interface BarVote {
  id: string
  place_id: string
  user_id: string
  created_at: string
}

export function useBarVotes() {
  const { session } = useAuth()
  const userId = session?.user.id

  const [votes, setVotes] = useState<BarVote[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch all votes
  const fetchVotes = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('bar_votes')
      .select('*')
      .order('created_at', { ascending: false })

    setVotes((data ?? []) as BarVote[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchVotes()

    // Real-time subscription
    const channel = supabase
      .channel('bar_votes_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bar_votes' }, (payload) => {
        const newVote = payload.new as BarVote
        setVotes((prev) => [newVote, ...prev])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bar_votes' }, (payload) => {
        const oldVote = payload.old as { id: string }
        setVotes((prev) => prev.filter((v) => v.id !== oldVote.id))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchVotes])

  // Get vote count for a specific bar
  const getVoteCount = useCallback(
    (placeId: string): number => {
      return votes.filter((v) => v.place_id === placeId).length
    },
    [votes]
  )

  // Check if current user has voted for a bar
  const hasUserVoted = useCallback(
    (placeId: string): boolean => {
      if (!userId) return false
      return votes.some((v) => v.place_id === placeId && v.user_id === userId)
    },
    [votes, userId]
  )

  // Get user IDs who voted for a bar
  const getVoterIds = useCallback(
    (placeId: string): string[] => {
      return votes.filter((v) => v.place_id === placeId).map((v) => v.user_id)
    },
    [votes]
  )

  // Vote for a bar
  const vote = useCallback(
    async (placeId: string): Promise<boolean> => {
      if (!userId) return false

      const { error } = await supabase.from('bar_votes').insert({
        place_id: placeId,
        user_id: userId,
      })

      return !error
    },
    [userId]
  )

  // Remove vote from a bar
  const unvote = useCallback(
    async (placeId: string): Promise<boolean> => {
      if (!userId) return false

      const { error } = await supabase
        .from('bar_votes')
        .delete()
        .eq('place_id', placeId)
        .eq('user_id', userId)

      return !error
    },
    [userId]
  )

  // Toggle vote
  const toggleVote = useCallback(
    async (placeId: string): Promise<boolean> => {
      if (hasUserVoted(placeId)) {
        return unvote(placeId)
      } else {
        return vote(placeId)
      }
    },
    [hasUserVoted, vote, unvote]
  )

  return {
    votes,
    loading,
    getVoteCount,
    hasUserVoted,
    getVoterIds,
    vote,
    unvote,
    toggleVote,
  }
}
