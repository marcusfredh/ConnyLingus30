import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

export function useAdmin() {
  const { session } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        setIsAdmin(data?.role === 'admin')
        setLoading(false)
      })
  }, [session])

  return { isAdmin, loading }
}
