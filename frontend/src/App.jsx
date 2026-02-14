import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Header from './components/Header'
import AccountPanel from './components/AccountPanel'
import { LoginForm, RegisterForm, VerifyForm, OAuthButtons } from './components/AuthForms'
import { apiRequest, oauthLinks } from './services/api'

const defaultApiBase = 'http://localhost:8080'

function App() {
  const [apiBase] = useState(() => import.meta.env.VITE_API_BASE || defaultApiBase)
  const [view, setView] = useState('home')
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    verificationCode: '',
  })
  const [profile, setProfile] = useState(null)
  const [tokens, setTokens] = useState(() => {
    const stored = localStorage.getItem('tokens')
    return stored ? JSON.parse(stored) : null
  })
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (tokens) localStorage.setItem('tokens', JSON.stringify(tokens))
    else localStorage.removeItem('tokens')
  }, [tokens])

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
      setTokens(data)
      return data
    })

  const verify = () =>
    run('verify', async () => {
      const data = await apiRequest('/api/auth/verify', {
        body: { email: form.email, verificationCode: form.verificationCode },
      })
      setTokens(data)
      setView('home')
      return data
    })

  const resend = () =>
    run('resend', () => apiRequest('/api/auth/resend', { body: { email: form.email } }))

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', token: tokens?.accessToken })
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
    if (!tokens?.accessToken) {
      setProfile(null)
      return
    }
    const data = await apiRequest('/api/users/me', { method: 'GET', token: tokens.accessToken })
    setProfile(data)
  }

  const updateProfile = async () => {
    if (!tokens?.accessToken) return
    const payload = {
      username: profile?.username,
      email: profile?.email,
      avatarUrl: profile?.avatarUrl,
    }
    const data = await apiRequest('/api/users/me', { method: 'PATCH', body: payload, token: tokens.accessToken })
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

  return (
    <div className="page">
      <Header
        apiBase={apiBase}
        tokens={tokens}
        onGo={go}
        onAccount={() => {
          go('account')
          loadProfile()
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
          tokens={tokens}
        />
      )}

      <section className="panel">
        <h3>Tokens</h3>
        {tokens ? <pre className="code">{JSON.stringify(tokens, null, 2)}</pre> : <p className="muted">No tokens stored</p>}
      </section>

      <ResultPanel />
    </div>
  )
}

export default App
