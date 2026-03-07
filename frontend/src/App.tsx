import { useEffect, useMemo, useState, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom'
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
import { UserSearch } from './components/users/user-search'
import { UserProfileView } from './components/users/user-profile'
import { ChatList } from './components/chat/chat-list'
import { ChatWindow } from './components/chat/chat-window'
import {
  apiRequest, oauthLinks, createCapsule, listMyCapsules, getCapsule, unlockCapsule, getCurrentUser, updateCurrentUser, getUserProfile, getFollowing,
  type UserProfile, type Capsule, type ApiError, type CreateCapsulePayload, type UserPublic,
} from './services/api'
import { connectCapsuleStream, disconnectCapsuleStream } from './services/ws'
import { EmptyState } from './components/empty-state'
import { ShieldOff } from 'lucide-react'

function App() {
  const [form, setForm] = useState({ username: '', email: '', password: '', verificationCode: '' })
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tokens, setTokens] = useState<{ session: string } | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [capsules, setCapsules] = useState<Capsule[]>([])
  const [capsulesLoading, setCapsulesLoading] = useState(false)
  const [selectedCapsule, setSelectedCapsule] = useState<Capsule | null>(null)
  const [following, setFollowing] = useState<UserPublic[]>([])
  const [loadingCapsule, setLoadingCapsule] = useState(false)

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
    loadFollowing(data.id)
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

  // --- Load capsules when navigating to /capsules or /account ---
  useEffect(() => {
    if ((location.pathname === '/capsules' || location.pathname === '/account') && isAuthenticated) {
      loadCapsules()
    }
  }, [location.pathname, isAuthenticated])

  // --- Load following list after session ---
  const loadFollowing = useCallback(async (userId?: string) => {
    if (!userId) return
    try { const data = await getFollowing(userId); setFollowing(data) } catch { setFollowing([]) }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !profile?.id) return
    loadFollowing(profile.id)
  }, [isAuthenticated, profile?.id])

  // Refresh following list when opening a capsule detail (so share dialog has data)
  useEffect(() => {
    if (selectedCapsule && isAuthenticated && profile?.id) {
      loadFollowing(profile.id)
    }
  }, [selectedCapsule?.id, isAuthenticated, profile?.id])

  // Direct navigation to /capsules/:id — fetch capsule and surface access errors
  useEffect(() => {
    if (!location.pathname.startsWith('/capsules/')) return
    const [, , id] = location.pathname.split('/')
    if (!id || selectedCapsule?.id === id || loadingCapsule) return
    setLoadingCapsule(true)
    getCapsule(id)
      .then(setSelectedCapsule)
      .catch((err: any) => setError(err))
      .finally(() => setLoadingCapsule(false))
  }, [location.pathname, selectedCapsule?.id, loadingCapsule])

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
            profile ? <UserProfileView user={profile} isOwnProfile capsulesCount={capsules.length} /> : null
          } />

          <Route path="/account/settings" element={
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
              <CapsuleDetail capsule={selectedCapsule} following={following} onBack={async () => { await loadCapsules(); navigate('/capsules') }} onUnlock={handleUnlockCapsule} error={error} onRefreshFollowing={() => profile?.id && loadFollowing(profile.id)} />
            ) : error ? (
              <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
                <div className="w-full max-w-3xl">
                  <EmptyState
                    icon={ShieldOff}
                    title={error?.status === 403 ? 'You don’t have access to this capsule' : 'Capsule not found'}
                    description={error?.status === 403
                      ? 'Ask the owner to share access with you or send you a fresh invite link.'
                      : 'The link might be outdated or the capsule was removed. Please check the URL or contact the owner.'}
                    actionLabel="Back to capsules"
                    onAction={() => navigate('/capsules')}
                  />
                </div>
              </div>
             ) : (
               <div className="mx-auto max-w-2xl px-4 py-10 text-center text-sm text-muted-foreground">Завантаження капсули...</div>
             )
          } />

          <Route path="/search" element={<UserSearch />} />

          <Route path="/profile/:username" element={<ProfileRoute currentUserId={profile?.id} />} />

          <Route path="/chat" element={
            <div className="mx-auto max-w-4xl px-4 py-6" style={{ minHeight: '70vh' }}>
              <ChatList currentUserId={profile?.id} />
            </div>
          } />

          <Route path="/chat/:userId" element={<ChatRoute />} />

          {/* OAuth redirect handler — handled by useEffect above */}
          <Route path="/auth/oauth2/redirect" element={null} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

function ProfileRoute({ currentUserId }: { currentUserId?: string }) {
  const { username } = useParams<{ username: string }>()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!username) return
    setLoading(true)
    getUserProfile(username).then(setUserProfile).catch(() => setUserProfile(null)).finally(() => setLoading(false))
  }, [username])

  if (loading) return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>
  if (!userProfile) return <div className="py-24 text-center text-muted-foreground">User not found</div>

  const isOwn = currentUserId === userProfile.id
  return <UserProfileView user={userProfile} isOwnProfile={isOwn} />
}

function ChatRoute() {
  const { userId } = useParams<{ userId: string }>()
  if (!userId) return null
  return (
    <div className="mx-auto max-w-4xl px-4 py-6" style={{ minHeight: '70vh' }}>
      <ChatWindow userId={userId} />
    </div>
  )
}

export default App

