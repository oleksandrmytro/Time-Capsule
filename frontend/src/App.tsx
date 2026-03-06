import { useEffect, useMemo, useState, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
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
import {
  apiRequest, oauthLinks, createCapsule, listMyCapsules, getCapsule, unlockCapsule, getCurrentUser, updateCurrentUser,
  type UserProfile, type Capsule, type ApiError, type CreateCapsulePayload,
} from './services/api'
import { connectCapsuleStream, disconnectCapsuleStream } from './services/ws'

function App() {
  const [form, setForm] = useState({ username: '', email: '', password: '', verificationCode: '' })
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tokens, setTokens] = useState<{ session: string } | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [capsules, setCapsules] = useState<Capsule[]>([])
  const [capsulesLoading, setCapsulesLoading] = useState(false)
  const [selectedCapsule, setSelectedCapsule] = useState<Capsule | null>(null)

  const navigate = useNavigate()
  const location = useLocation()

  const isAuthenticated = Boolean(tokens && profile)
  // data: any - Функція приймає будь-який тип даних, бо API може повернути що завгодно
  // : data is UserProfile - Це спеціальний TypeScript синтаксис.
  // -- Якщо функція повертає true, TypeScript розуміє, що data тепер має тип UserProfile в цьому контексті.
  // Boolean(...) - Це просто спосіб перетворити результат на булеве значення. Він поверне true, якщо всі умови виконуються, і false в іншому випадку.
  // data && typeof data === 'object' && !Array.isArray(data) - Перевіряє, що data існує, є об'єктом і не є масивом.
    // data.id && data.email - Перевіряє, що в об'єкті є властивості id та email, які є необхідними для UserProfile.
  const isValidProfile = (data: any): data is UserProfile =>
    Boolean(data && typeof data === 'object' && !Array.isArray(data) && data.id && data.email)

  // --- Session ---
  const establishSession = async () => {
    const data = await getCurrentUser()
    if (!isValidProfile(data)) throw { status: 401, message: 'Invalid profile response' }
    setProfile(data)
    setTokens({ session: 'cookie' })
  }
  // apiRequest('/api/auth/session', { method: 'GET' }) - Для того щоб дізнатись чи є активна сесія користувача(чи залогінений)
  // Якщо відповідь показує, що користувач аутентифікований, ми викликаємо establishSession(), щоб отримати його профіль і встановити токени.
  // Якщо ж користувач не аутентифікований, ми очищуємо токени та профіль(setTokens(null); setProfile(null)
  const bootstrapSession = async () => {
    const data = await apiRequest('/api/auth/session', { method: 'GET' })
    if (data?.authenticated) { await establishSession(); return }
    setTokens(null); setProfile(null)
  }

  // Повторяє спробу встановити сесія кілька разів із затримкою, якщо виникають проблеми наприклад з мережею або бекендом
  // Тобто в циклі пробує викликати метод establishSession(), якщо усе успішно то виходить з функції
  // Якщо виникає помилка то зберігає її в lastError, чекає затримку(delayMs) та пробує знову
  const establishSessionWithRetry = async (attempts = 3, delayMs = 250) => {
    let lastError: any
    for (let i = 0; i < attempts; i++) {
      try { await establishSession(); return } catch (err) { lastError = err; if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs)) }
    }
    throw lastError
  }

  // useEffect - Реакт-хук, тобто виконує код після рендерингу компонентів
  // Якщо передати порожній масив залежностей([]), то код виконається лише один раз - при старті компонента(при запуску додатку або оновлені сторінки)
  // Якщо поточний шлях location.pathname це /auth/oauth2/redirect то функція нічого не робить та завершується(це для того щоб під час обробки OAuth не перевіряти сесію)
  // Але якщо поточний маршрут не такий то викликається bootstrapSession(), щоб перевірити чи є активна сесія користувача та встановити її.
  useEffect(() => {
    if (location.pathname === '/auth/oauth2/redirect') return
    bootstrapSession().catch(() => { setTokens(null); setProfile(null) })
  }, [])

  // Виконується на маршруті /auth/oauth2/redirect
  // Обробляє повернення користувача з OAuth провайдера.
  // Якщо є помилка - показує її та перенаправляє на сторінку логіну
  // Якщо помилки немає - намагається встановити сесію кілька разів(establishSessionWithRetry())
  useEffect(() => {
    if (location.pathname !== '/auth/oauth2/redirect') return
    const params = new URLSearchParams(location.search)
    const err = params.get('error')
    if (err) {
      setError({ status: 0, message: decodeURIComponent(err) })
      navigate('/login', { replace: true })
      return
    }
    establishSessionWithRetry()
      .then(() => { setError(null); navigate('/', { replace: true }) })
      .catch(() => { setError({ status: 0, message: 'OAuth login failed' }); navigate('/login', { replace: true }) })
  }, [])

  // --- Navigation helpers ---
  // Просто обробка зміни значення будь-якого поля форми (логін, реєстрація, верифікація) та збереження його в стані form
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // Визначає чи потрібно заблокувати кнопку авторизації/реєстрації
  const disabledAuth = useMemo(() => {
    const isRegister = location.pathname === '/register'
    return !form.email || !form.password || (isRegister && !form.username)
  }, [form.email, form.password, form.username, location.pathname])

  // --- Auth ---
  // Очищає помилку (setError(null))
  // Відравляє POST-запит на бек з даними форми
  // Якщо запит успішний, перенаправляє користувача на сторінку верифікації (/verify)
  const signup = async () => {
    setError(null)
    await apiRequest('/api/auth/signup', { body: { username: form.username, email: form.email, password: form.password } })
    navigate('/verify')
  }

  // Відправляє POST-запит на бек з даними форми для логіну
    // Якщо запит успішний, викликає establishSession() для отримання профілю користувача та встановлення токенів, а потім перенаправляє на головну сторінку (/)
  const login = async () => {
    setError(null)
    await apiRequest('/api/auth/login', { body: { email: form.email, password: form.password } })
    await establishSession()
    navigate('/')
  }

  const verify = async () => {
    setError(null)
    await apiRequest('/api/auth/verify-and-login', { body: { email: form.email, verificationCode: form.verificationCode } })
    await establishSession()
    navigate('/')
  }

  const resend = async () => {
    await apiRequest('/api/auth/resend', { body: { email: form.email } })
  }

  const logout = async () => {
    try { await apiRequest('/api/auth/logout', { method: 'POST' }) } catch {}
    // Відключає WebSocket-стрім (реального часу)
    disconnectCapsuleStream()
    setTokens(null); setProfile(null)
    navigate('/')
  }

  // --- Profile ---
  const loadProfile = async () => {
    if (!tokens) { setProfile(null); return }
    try {
      const data = await getCurrentUser()
      if (!isValidProfile(data)) throw { status: 401 }
      setProfile(data)
    } catch { setTokens(null); setProfile(null); navigate('/login') }
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
    catch (err: any) { setError(err); setCapsules([]) }
    finally { setCapsulesLoading(false) }
  }, [])

  const handleCreateCapsule = async (capsuleData: CreateCapsulePayload) => {
    setError(null)
    await createCapsule(capsuleData)
    await loadCapsules()
    navigate('/capsules')
  }

  const viewCapsule = async (id: string) => {
    setError(null)
    try {
      const data = await getCapsule(id)
      setSelectedCapsule(data)
      navigate(`/capsules/${id}`)
    } catch (err: any) { setError(err) }
  }

  const handleUnlockCapsule = async (id: string) => {
    setError(null)
    try {
      const data = await unlockCapsule(id)
      setSelectedCapsule(data)
      await loadCapsules()
    } catch (err: any) { setError(err) }
  }

  // --- Load capsule detail on direct navigation/refresh ---
  useEffect(() => {
    const match = location.pathname.match(/^\/capsules\/(.+)$/)
    const capsuleId = match?.[1]
    if (!capsuleId) return
    if (selectedCapsule?.id === capsuleId) return
    setError(null)
    getCapsule(capsuleId)
      .then((data) => setSelectedCapsule(data))
      .catch((err: any) => setError(err))
  }, [location.pathname, selectedCapsule?.id])

  // --- WebSocket ---
  useEffect(() => {
    if (!isAuthenticated) return
    connectCapsuleStream({
      onEvent: () => { loadCapsules() },
      onError: (msg) => console.warn('WS error:', msg),
    })
    return () => disconnectCapsuleStream()
  }, [isAuthenticated, loadCapsules])

  // --- Load capsules when navigating to /capsules ---
  useEffect(() => {
    if (location.pathname === '/capsules' && isAuthenticated) {
      loadCapsules()
    }
  }, [location.pathname, isAuthenticated])

  // --- Render ---
  return (
    <div className="flex min-h-screen flex-col">
      <Header
        isAuthenticated={isAuthenticated}
        onAccount={() => loadProfile()}
        onLogout={logout}
        onLoadCapsules={loadCapsules}
      />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={
            <>
              <HeroSection isAuthenticated={isAuthenticated} onLoadCapsules={loadCapsules} />
              {!isAuthenticated && <HowItWorks />}
              {!isAuthenticated && <CtaSection />}
            </>
          } />

          <Route path="/login" element={
            <LoginForm form={form} onChange={handleChange} onLogin={login} disabled={disabledAuth} oauth={oauthLinks()} error={error} />
          } />

          <Route path="/register" element={
            <RegisterForm form={form} onChange={handleChange} onSignup={signup} disabled={disabledAuth} oauth={oauthLinks()} error={error} />
          } />

          <Route path="/verify" element={
            <VerifyForm form={form} onChange={handleChange} onVerify={verify} onResend={resend} error={error} />
          } />

          <Route path="/account" element={
            <AccountForm profile={profile} onProfileChange={setProfile} onSave={updateProfile} onLogout={logout} />
          } />

          <Route path="/create" element={
            <CreateCapsuleForm onSubmit={handleCreateCapsule} error={error} />
          } />

          <Route path="/capsules" element={
            <CapsulesList capsules={capsules} isLoading={capsulesLoading} onSelect={viewCapsule} onCreate={() => navigate('/create')} />
          } />

          <Route path="/capsules/:id" element={
            selectedCapsule ? (
              <CapsuleDetail capsule={selectedCapsule} onBack={async () => { await loadCapsules(); navigate('/capsules') }} onUnlock={handleUnlockCapsule} error={error} />
            ) : null
          } />

          {/* OAuth redirect handler — handled by useEffect above */}
          <Route path="/auth/oauth2/redirect" element={null} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App

