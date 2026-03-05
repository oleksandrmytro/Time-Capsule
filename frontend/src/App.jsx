import { useEffect, useMemo, useState, useCallback } from 'react'
import './App.css'
import Header from './components/Header'
import { Footer } from './components/footer'
import { HeroSection } from './components/landing/hero-section'
import { HowItWorks } from './components/landing/how-it-works'
import { CtaSection } from './components/landing/cta-section'
import { LoginForm } from './components/auth/login-form'
import { RegisterForm } from './components/auth/register-form'
import { VerifyForm } from './components/auth/verify-form'
import { AccountForm } from './components/account/account-form'
import { CapsulesList } from './components/capsules/capsules-list'
import { CreateCapsuleForm } from './components/capsules/create-capsule-form'
import { CapsuleDetail } from './components/capsules/capsule-detail'
import { apiRequest, oauthLinks, createCapsule, listMyCapsules, getCapsule, unlockCapsule, getCurrentUser, updateCurrentUser } from './services/api'
import { connectCapsuleStream, disconnectCapsuleStream } from './services/ws'

function App() {
  const [view, setView] = useState('home')
  const [form, setForm] = useState({ username: '', email: '', password: '', verificationCode: '' })
  const [profile, setProfile] = useState(null)
  const [tokens, setTokens] = useState(null)
  const [error, setError] = useState(null)
  const [capsules, setCapsules] = useState([])
  const [capsulesLoading, setCapsulesLoading] = useState(false)
  const [selectedCapsule, setSelectedCapsule] = useState(null)

  const isAuthenticated = Boolean(tokens && profile)
  const isValidProfile = (data) => Boolean(data && typeof data === 'object' && !Array.isArray(data) && data.id && data.email)

  // --- Session ---
  const establishSession = async () => {
    const data = await getCurrentUser()
    if (!isValidProfile(data)) throw { status: 401, message: 'Invalid profile response' }
    setProfile(data)
    setTokens({ session: 'cookie' })
    setView('home')
  }

  const bootstrapSession = async () => {
    const data = await apiRequest('/api/auth/session', { method: 'GET' })
    if (data?.authenticated) { await establishSession(); return }
    setTokens(null); setProfile(null)
  }

  const establishSessionWithRetry = async (attempts = 3, delayMs = 250) => {
    let lastError
    for (let i = 0; i < attempts; i++) {
      try { await establishSession(); return } catch (err) { lastError = err; if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs)) }
    }
    throw lastError
  }

  useEffect(() => {
    if (window.location.pathname === '/auth/oauth2/redirect') return
    bootstrapSession().catch(() => { setTokens(null); setProfile(null) })
  }, [])

  useEffect(() => {
    const { pathname, search } = window.location
    if (pathname !== '/auth/oauth2/redirect') return
    const params = new URLSearchParams(search)
    const err = params.get('error')
    if (err) { setError({ message: decodeURIComponent(err) }); setView('login'); window.history.replaceState({}, '', '/'); return }
    establishSessionWithRetry().then(() => setError(null)).catch(() => { setError({ message: 'OAuth login failed' }); setView('login') }).finally(() => window.history.replaceState({}, '', '/'))
  }, [])

  // --- Navigation ---
  const go = (next) => { setView(next); setError(null) }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const disabledAuth = useMemo(() => !form.email || !form.password || (view === 'register' && !form.username), [form.email, form.password, form.username, view])

  // --- Auth ---
  const signup = async () => {
    setError(null)
    await apiRequest('/api/auth/signup', { body: { username: form.username, email: form.email, password: form.password } })
    setView('verify')
  }

  const login = async () => {
    setError(null)
    await apiRequest('/api/auth/login', { body: { email: form.email, password: form.password } })
    await establishSession()
  }

  const verify = async () => {
    setError(null)
    await apiRequest('/api/auth/verify-and-login', { body: { email: form.email, verificationCode: form.verificationCode } })
    await establishSession()
  }

  const resend = async () => {
    await apiRequest('/api/auth/resend', { body: { email: form.email } })
  }

  const logout = async () => {
    try { await apiRequest('/api/auth/logout', { method: 'POST' }) } catch {}
    disconnectCapsuleStream()
    setTokens(null); setProfile(null); setView('home')
  }

  // --- Profile ---
  const loadProfile = async () => {
    if (!tokens) { setProfile(null); return }
    try {
      const data = await getCurrentUser()
      if (!isValidProfile(data)) throw { status: 401 }
      setProfile(data)
    } catch { setTokens(null); setProfile(null); setView('login') }
  }

  const updateProfile = async () => {
    if (!tokens) return
    const data = await updateCurrentUser({ username: profile?.username, email: profile?.email, avatarUrl: profile?.avatarUrl })
    setProfile(data)
  }

  // --- Capsules ---
  const loadCapsules = useCallback(async () => {
    setCapsulesLoading(true); setError(null)
    try { const data = await listMyCapsules(); setCapsules(Array.isArray(data) ? data : []) }
    catch (err) { setError(err); setCapsules([]) }
    finally { setCapsulesLoading(false) }
  }, [])

  const handleCreateCapsule = async (capsuleData) => {
    setError(null)
    await createCapsule(capsuleData)
    await loadCapsules()
    setView('capsules')
  }

  const viewCapsule = async (id) => {
    setError(null)
    try { const data = await getCapsule(id); setSelectedCapsule(data); setView('viewCapsule') }
    catch (err) { setError(err) }
  }

  const handleUnlockCapsule = async (id) => {
    setError(null)
    try {
      const data = await unlockCapsule(id)
      setSelectedCapsule(data)
      await loadCapsules()
    }
    catch (err) { setError(err) }
  }

  // --- WebSocket: connect after login, disconnect on logout ---
  useEffect(() => {
    if (!isAuthenticated) return
    connectCapsuleStream({
      onEvent: () => {
        // Server pushed a capsule status change — refresh list + detail
        loadCapsules()
      },
      onError: (msg) => console.warn('WS error:', msg)
    })
    return () => disconnectCapsuleStream()
  }, [isAuthenticated, loadCapsules])

  // --- Render ---
  return (
    <div className="flex min-h-screen flex-col">
      <Header
        isAuthenticated={isAuthenticated}
        onGo={(v) => { if (v === 'capsules') loadCapsules(); go(v) }}
        onAccount={async () => { await loadProfile(); go('account') }}
        onLogout={logout}
      />
      <main className="flex-1">
        {view === 'home' && (
          <>
            <HeroSection isAuthenticated={isAuthenticated} onGo={go} onLoadCapsules={loadCapsules} />
            {!isAuthenticated && <HowItWorks />}
            {!isAuthenticated && <CtaSection onRegister={() => go('register')} />}
          </>
        )}
        {view === 'login' && (
          <LoginForm form={form} onChange={handleChange} onLogin={login} onGoHome={() => go('home')} onGoRegister={() => go('register')} disabled={disabledAuth} oauth={oauthLinks()} error={error} />
        )}
        {view === 'register' && (
          <RegisterForm form={form} onChange={handleChange} onSignup={signup} onGoHome={() => go('home')} onGoLogin={() => go('login')} disabled={disabledAuth} oauth={oauthLinks()} error={error} />
        )}
        {view === 'verify' && (
          <VerifyForm form={form} onChange={handleChange} onVerify={verify} onResend={resend} onGoLogin={() => go('login')} onGoHome={() => go('home')} error={error} />
        )}
        {view === 'account' && (
          <AccountForm profile={profile} onProfileChange={setProfile} onSave={updateProfile} onLogout={logout} onHome={() => go('home')} />
        )}
        {view === 'createCapsule' && (
          <CreateCapsuleForm onSubmit={handleCreateCapsule} onCancel={() => go('home')} error={error} />
        )}
        {view === 'capsules' && (
          <CapsulesList capsules={capsules} isLoading={capsulesLoading} onSelect={viewCapsule} onCreate={() => go('createCapsule')} onBack={() => go('home')} />
        )}
        {view === 'viewCapsule' && selectedCapsule && (
          <CapsuleDetail capsule={selectedCapsule} onBack={async () => { await loadCapsules(); go('capsules') }} onBackHome={() => go('home')} onUnlock={handleUnlockCapsule} error={error} />
        )}
      </main>
      <Footer onHome={() => go('home')} />
    </div>
  )
}

export default App
