import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export function useMatch() {
  const { matchId } = useParams()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(Boolean(matchId))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!matchId) {
      setMatch(null)
      setLoading(false)
      setError(null)
      return
    }

    let isMounted = true

    async function fetchMatch() {
      setLoading(true)
      setError(null)

      const { data, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      if (matchError) {
        setError(matchError)
        setMatch(null)
      } else {
        setMatch(data)
      }

      setLoading(false)
    }

    fetchMatch()

    return () => {
      isMounted = false
    }
  }, [matchId])

  return { match, loading, error, matchId }
}
