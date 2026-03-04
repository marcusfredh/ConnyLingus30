import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type ProfileMap = Record<string, string> // user_id → username

export function useProfiles() {
  const [profiles, setProfiles] = useState<ProfileMap>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('profiles').select('user_id, username')
      const map: ProfileMap = {}
      for (const p of data ?? []) map[p.user_id] = p.username
      setProfiles(map)
      setLoading(false)
    }
    load()
  }, [])

  /** Returns the display name for a user_id, falls back to 'Okänd' */
  function nameOf(userId: string): string {
    return profiles[userId] ?? 'Okänd'
  }

  return { profiles, nameOf, loading }
}
