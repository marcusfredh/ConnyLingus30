import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const DOMAIN = '@connylingus30.se'

export function LoginPage() {
  const { signIn, session } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Already logged in — redirect away
  if (session) {
    navigate('/', { replace: true })
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const email = username.trim().toLowerCase() + DOMAIN
    const authError = await signIn(email, password)

    if (authError) {
      setError('Felaktigt användarnamn eller lösenord. Försök igen.')
      setLoading(false)
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-50">Välkommen!</h1>
          <p className="text-gray-400 mt-1 text-sm">Logga in för att fortsätta</p>
        </div>

        {/* Card */}
        <div className="bg-gray-800 rounded-2xl shadow-sm border border-gray-700 px-6 py-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1.5">
                Användarnamn
              </label>
              <div className="flex items-center rounded-xl border border-gray-600 bg-gray-700 focus-within:ring-2 focus-within:ring-indigo-400 focus-within:border-transparent transition overflow-hidden">
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="namn"
                  className="flex-1 px-4 py-3 text-base bg-transparent text-gray-50 placeholder-gray-500 focus:outline-none min-w-0"
                />
                <span className="pr-4 text-gray-500 text-sm select-none whitespace-nowrap hidden"></span>
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Lösenord
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 text-base rounded-xl border border-gray-600 bg-gray-700 text-gray-50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl text-base transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Loggar in…' : 'Logga in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
