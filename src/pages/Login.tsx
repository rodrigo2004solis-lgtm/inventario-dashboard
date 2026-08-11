import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await signIn(email, password)

    setSubmitting(false)

    if (error) {
      setError('Correo o contraseña incorrectos.')
      return
    }

    navigate('/')
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950 relative">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 rounded-xl shadow-md w-full max-w-sm"
      >
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Sync Inventario</h1>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
        />

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg py-2 font-medium hover:bg-gray-800 dark:hover:bg-gray-300 disabled:opacity-50"
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}