import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Header from './components/Header'
import AccountPanel from './components/AccountPanel'
import { LoginForm, RegisterForm, VerifyForm, OAuthButtons } from './components/AuthForms'
import { apiRequest, oauthLinks } from './services/api'

const resolveApiBase = () =>
  import.meta.env.VITE_API_ORIGIN ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  window.location.origin

function App() {
  const [apiBase] = useState(resolveApiBase)
  const [view, setView] = useState('home')
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    verificationCode: '',
  })
  const [profile, setProfile] = useState(null)
  const [tokens, setTokens] = useState(null)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)

  const isValidProfile = (data) =>
    Boolean(data && typeof data === 'object' && !Array.isArray(data) && data.id && data.email)

  const establishSession = async () => {
    const data = await apiRequest('/api/users/me', { method: 'GET' })
    if (!isValidProfile(data)) {
      throw { status: 401, message: 'Invalid profile response' }
    }
    setProfile(data)
    setTokens({ session: 'cookie' })
    setView('home')
  }

  const bootstrapSession = async () => {
    const data = await apiRequest('/api/auth/session', { method: 'GET' })
    if (data?.authenticated) {
      await establishSession()
      return
    }

    setTokens(null)
    setProfile(null)
  }

  const establishSessionWithRetry = async (attempts = 3, delayMs = 250) => {
    let lastError
    for (let i = 0; i < attempts; i += 1) {
      try {
        await establishSession()
        return
      } catch (err) {
        lastError = err
        if (i < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }
    throw lastError
  }

  useEffect(() => {
    const isOauthRedirect = window.location.pathname === '/auth/oauth2/redirect'
    if (isOauthRedirect) {
      return
    }

    bootstrapSession().catch(() => {
      setTokens(null)
      setProfile(null)
    })
  }, [])

  useEffect(() => {
    const { pathname, search } = window.location
    if (pathname !== '/auth/oauth2/redirect') return

    const params = new URLSearchParams(search)
    const error = params.get('error')
    if (error) {
      setError({ message: decodeURIComponent(error) })
      setView('login')
      window.history.replaceState({}, '', '/')
      return
    }

    establishSessionWithRetry()
        .then(() => {
          setResponse({ action: 'oauthLogin', data: { provider: 'google/github', success: true } })
          setError(null)
        })
        .catch(() => {
          setError({ message: 'OAuth login completed but no active session found' })
          setView('login')
        })
        .finally(() => {
          window.history.replaceState({}, '', '/')
        })
  }, [])

  const disabledAuth = useMemo(
    () => !form.email || !form.password || (view === 'register' && !form.username),
    [form.email, form.password, form.username, view]
  )

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const run = async (action, fn) => {
    setError(null)
    setResponse(null)
    try {
      const data = await fn()
      setResponse({ action, data })
    } catch (err) {
      setError(err)
    }
  }

  const signup = () =>
    run('signup', async () => {
      const data = await apiRequest('/api/auth/signup', {
        body: { username: form.username, email: form.email, password: form.password },
      })
      setView('verify')
      return data
    })

  const login = () =>
    run('login', async () => {
      const data = await apiRequest('/api/auth/login', {
        body: { email: form.email, password: form.password },
      })
      await establishSession()
      return data
    })

  const verify = () =>
    run('verify', async () => {
      const data = await apiRequest('/api/auth/verify-and-login', {
        body: { email: form.email, verificationCode: form.verificationCode },
      })
      await establishSession()
      setView('home')
      return data
    })

  const resend = () =>
    run('resend', () => apiRequest('/api/auth/resend', { body: { email: form.email } }))

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST'})
    } catch (e) {
      // ignore
    }
    setTokens(null)
    setProfile(null)
    setResponse({ action: 'logout', data: 'Cleared tokens' })
    setView('home')
  }

  const go = (next) => {
    setView(next)
    setError(null)
    setResponse(null)
  }

  const loadProfile = async () => {
    if (!tokens) {
      setProfile(null)
      return
    }
    try {
      const data = await apiRequest('/api/users/me', { method: 'GET' })
      if (!isValidProfile(data)) {
        throw { status: 401, message: 'Invalid profile response' }
      }
      setProfile(data)
    } catch (e) {
      setTokens(null)
      setProfile(null)
      setView('login')
      throw e
    }
  }

  const updateProfile = async () => {
    if (!tokens) return
    const payload = {
      username: profile?.username,
      email: profile?.email,
      avatarUrl: profile?.avatarUrl,
    }
    const data = await apiRequest('/api/users/me', { method: 'PATCH', body: payload })
    setProfile(data)
    setResponse({ action: 'updateProfile', data })
  }

  const Home = () => (
    <section className="hero">
      <div>
        <h2>Welcome</h2>
        <p className="muted">Choose how you want to continue.</p>
        <div className="actions">
          <button onClick={() => go('login')}>Go to Login</button>
          <button onClick={() => go('register')} className="ghost">
            Create account
          </button>
        </div>
      </div>
      <OAuthButtons links={oauthLinks()} />
    </section>
  )

  const ResultPanel = () => (
    <section className="panel">
      <h3>Result</h3>
      {response && <pre className="code">{JSON.stringify(response, null, 2)}</pre>}
      {error && (
        <div className="error">
          <div>
            <strong>Error:</strong> {error.message || 'Request failed'}
          </div>
          {error.status && <div>Status: {error.status}</div>}
          {error.details && <pre className="code small">{JSON.stringify(error.details, null, 2)}</pre>}
        </div>
      )}
      {!response && !error && <p className="muted">No requests yet</p>}
    </section>
  )

  const isAuthenticated = Boolean(tokens && profile)

  return (
    <div className="page">
      <Header
        apiBase={apiBase}
        isAuthenticated={isAuthenticated}
        onGo={go}
        onAccount={async () => {
          try {
            await loadProfile()
            go('account')
          } catch (e) {
            // handled in loadProfile
          }
        }}
        onLogout={logout}
      />

      {view === 'home' && <Home />}
      {view === 'login' && (
        <LoginForm
          form={form}
          onChange={handleChange}
          onLogin={login}
          onGoHome={() => go('home')}
          onGoRegister={() => go('register')}
          disabled={disabledAuth}
          oauth={oauthLinks()}
        />
      )}
      {view === 'register' && (
        <RegisterForm
          form={form}
          onChange={handleChange}
          onSignup={signup}
          onGoHome={() => go('home')}
          onGoLogin={() => go('login')}
          disabled={disabledAuth}
          oauth={oauthLinks()}
        />
      )}
      {view === 'verify' && (
        <VerifyForm
          form={form}
          onChange={handleChange}
          onVerify={verify}
          onResend={resend}
          onGoLogin={() => go('login')}
        />
      )}
      {view === 'account' && (
        <AccountPanel
          profile={profile}
          onProfileChange={setProfile}
          onSave={updateProfile}
          onLogout={logout}
          onHome={() => go('home')}
          tokens={isAuthenticated ? tokens : null}
        />
      )}

      <section className="panel">
        <h3>Session</h3>
        {isAuthenticated ? <pre className="code">{JSON.stringify(tokens, null, 2)}</pre> : <p className="muted">No active session</p>}
      </section>

      <ResultPanel />
    </div>
  )
}

export default App
