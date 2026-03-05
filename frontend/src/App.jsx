import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Header from './components/Header'
import AccountPanel from './components/AccountPanel'
import { LoginForm, RegisterForm, VerifyForm, OAuthButtons } from './components/AuthForms'
import CreateCapsuleForm from './components/CreateCapsuleForm'
import CapsuleList from './components/CapsuleList'
import { apiRequest, oauthLinks, createCapsule, listMyCapsules, getCapsule, getCurrentUser, updateCurrentUser } from './services/api'

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
  const [capsules, setCapsules] = useState([])
  const [selectedCapsule, setSelectedCapsule] = useState(null)

  const isValidProfile = (data) =>
    Boolean(data && typeof data === 'object' && !Array.isArray(data) && data.id && data.email)

  const establishSession = async () => {
    const data = await getCurrentUser()
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
      const data = await getCurrentUser()
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
    const data = await updateCurrentUser(payload)
    setProfile(data)
    setResponse({ action: 'updateProfile', data })
  }

  const loadCapsules = async () => {
    try {
      setError(null)
      const data = await listMyCapsules()
      setCapsules(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err)
      setCapsules([])
    }
  }

  const handleCreateCapsule = async (capsuleData) => {
    try {
      setError(null)
      const data = await createCapsule(capsuleData)
      setResponse({ action: 'createCapsule', data })
      await loadCapsules()
      setView('capsules')
    } catch (err) {
      setError(err)
    }
  }

  const viewCapsule = async (id) => {
    try {
      setError(null)
      const data = await getCapsule(id)
      setSelectedCapsule(data)
      setView('viewCapsule')
    } catch (err) {
      setError(err)
    }
  }

  const Home = () => (
    <section className="hero">
      <div>
        <h2>Welcome{profile ? `, ${profile.username}` : ''}</h2>
        <p className="muted">
          {isAuthenticated
            ? 'Create and manage your time capsules.'
            : 'Choose how you want to continue.'}
        </p>
        <div className="actions">
          {isAuthenticated ? (
            <>
              <button onClick={() => go('createCapsule')}>Create Capsule</button>
              <button onClick={async () => {
                await loadCapsules()
                go('capsules')
              }} className="ghost">
                My Capsules
              </button>
            </>
          ) : (
            <>
              <button onClick={() => go('login')}>Go to Login</button>
              <button onClick={() => go('register')} className="ghost">
                Create account
              </button>
            </>
          )}
        </div>
      </div>
      {!isAuthenticated && <OAuthButtons links={oauthLinks()} />}
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
      {view === 'createCapsule' && (
        <CreateCapsuleForm
          onSubmit={handleCreateCapsule}
          onCancel={() => go('home')}
          error={error}
        />
      )}
      {view === 'capsules' && (
        <CapsuleList
          capsules={capsules}
          onSelect={viewCapsule}
          onCreate={() => go('createCapsule')}
          onBack={() => go('home')}
        />
      )}
      {view === 'viewCapsule' && selectedCapsule && (
        <section className="panel">
          <h3>{selectedCapsule.title}</h3>
          <div style={{ marginBottom: '15px' }}>
            <p><strong>Status:</strong> {selectedCapsule.status}</p>
            <p><strong>Visibility:</strong> {selectedCapsule.visibility}</p>
            <p><strong>Unlocks:</strong> {new Date(selectedCapsule.unlockAt).toLocaleString()}</p>
            {selectedCapsule.expiresAt && (
              <p><strong>Expires:</strong> {new Date(selectedCapsule.expiresAt).toLocaleString()}</p>
            )}
          </div>
          {selectedCapsule.body && (
            <div style={{ marginBottom: '15px' }}>
              <strong>Message:</strong>
              <p style={{ whiteSpace: 'pre-wrap' }}>{selectedCapsule.body}</p>
            </div>
          )}
          {selectedCapsule.tags && selectedCapsule.tags.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <strong>Tags:</strong>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '5px' }}>
                {selectedCapsule.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '2px 8px',
                      backgroundColor: '#e9ecef',
                      borderRadius: '3px',
                      fontSize: '12px',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {selectedCapsule.shareToken && (
            <div style={{ marginBottom: '15px' }}>
              <strong>Share Token:</strong> {selectedCapsule.shareToken}
            </div>
          )}
          <div>
            <button onClick={() => go('capsules')}>Back to List</button>
            <button onClick={() => go('home')} className="ghost" style={{ marginLeft: '10px' }}>
              Home
            </button>
          </div>
        </section>
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
