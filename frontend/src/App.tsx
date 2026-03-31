import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom'
import Header from './components/Header'
import { Footer } from './components/footer'
import { HeroSection } from './components/landing/hero-section'
import { HowItWorks } from './components/landing/how-it-works'
import { CtaSection } from './components/landing/cta-section'
import { CosmicLandingConcept } from './components/landing/cosmic-landing-concept'
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
import { CalendarView } from './components/capsules/calendar-view'
import { CapsulesMapView } from './components/capsules/capsules-map-view'
import { AdminPanel } from './components/admin/admin-panel'
import {
  apiRequest, oauthLinks, createCapsule, listMyCapsules, getCapsule, unlockCapsule, getCurrentUser, updateCurrentUser, getUserProfile, getFollowing, getFollowers, getUserCapsules, followUser, unfollowUser,
  stopImpersonation as stopImpersonationApi,
  type UserProfile, type Capsule, type ApiError, type CreateCapsulePayload, type UserPublic,
} from './services/api'
import { connectCapsuleStream, disconnectCapsuleStream } from './services/ws'
import { EmptyState } from './components/empty-state'
import { Loader2, MessageCircle, PenSquare, ShieldOff, Sparkles } from 'lucide-react'
import { SpaceBackgroundFrame } from './components/space-background-frame'

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/
const safeDecodeSegment = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function App() {
  const [form, setForm] = useState({ username: '', email: '', password: '', verificationCode: '' })
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tokens, setTokens] = useState<{ session: string } | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [capsules, setCapsules] = useState<Capsule[]>([])
  const [capsulesLoading, setCapsulesLoading] = useState(false)
  const [selectedCapsule, setSelectedCapsule] = useState<Capsule | null>(null)
  const [following, setFollowing] = useState<UserPublic[]>([])
  const [sessionResolved, setSessionResolved] = useState(false)
  const [footerHeight, setFooterHeight] = useState(52)
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const isCosmicConceptRoute = location.pathname.startsWith('/landing-concept')
  const isOauthRedirectRoute = location.pathname === '/auth/oauth2/redirect'
  const isChatRoute = location.pathname === '/chat' || location.pathname.startsWith('/chat/')
  const isCreateRoute = location.pathname === '/create'
  const isCalendarRoute = location.pathname === '/calendar'
  const isCapsulesRoute = location.pathname === '/capsules' || location.pathname.startsWith('/capsules/')
  const isMapRoute = location.pathname === '/map'
  const isSearchRoute = location.pathname === '/search'
  const isAccountRoute = location.pathname.startsWith('/account')
  const isPublicProfileRoute = location.pathname.startsWith('/profile/')
  const isAdminRoute = location.pathname.startsWith('/admin')
  const isAuthRoute =
    location.pathname === '/login'
    || location.pathname === '/register'
    || location.pathname === '/verify'
    || isOauthRedirectRoute

  const isAuthenticated = Boolean(tokens && profile)
  const isLandingRoute = location.pathname === '/'
  const hasFixedTopShell =
    isLandingRoute ||
    isChatRoute ||
    isCreateRoute ||
    isCalendarRoute ||
    isCapsulesRoute ||
    isMapRoute ||
    isSearchRoute ||
    isAccountRoute ||
    isPublicProfileRoute ||
    isAdminRoute
  const hasCosmicShell =
    isLandingRoute ||
    isChatRoute ||
    isCreateRoute ||
    isCalendarRoute ||
    isCapsulesRoute ||
    isMapRoute ||
    isSearchRoute ||
    isAccountRoute ||
    isPublicProfileRoute ||
    isAdminRoute
  const showFooter =
    !isCosmicConceptRoute &&
    !isOauthRedirectRoute &&
    !isAuthRoute &&
    !isAdminRoute
  const showImpersonationBanner = Boolean(isAuthenticated && profile?.impersonating)
  const shellOffset = showFooter ? 'calc(4rem + var(--tc-footer-height, 0px))' : '4rem'
  const topShellPaddingClass = hasFixedTopShell ? (showImpersonationBanner ? 'pt-[6.75rem]' : 'pt-16') : ''
  const showAuthenticatedLandingLayout = isAuthenticated || !sessionResolved
  const isAdmin = (profile?.role || '').toLowerCase() === 'admin' || (profile?.role || '').toUpperCase() === 'ROLE_ADMIN'
  // data: any - Функція приймає будь-який тип даних, бо API може повернути що завгодно
  // : data is UserProfile - Це спеціальний TypeScript синтаксис.
  // -- Якщо функція повертає true, TypeScript розуміє, що data тепер має тип UserProfile в цьому контексті.
  // Boolean(...) - Це просто спосіб перетворити результат на булеве значення. Він поверне true, якщо всі умови виконуються, і false в іншому випадку.
  // data && typeof data === 'object' && !Array.isArray(data) - Перевіряє, що data існує, є об'єктом і не є масивом.
    // data.id && data.email - Перевіряє, що в об'єкті є властивості id та email, які є необхідними для UserProfile.
  const isValidProfile = (data: any): data is UserProfile =>
    Boolean(data && typeof data === 'object' && !Array.isArray(data) && data.id && data.email)

  // --- Session ---
  const establishSession = async (): Promise<UserProfile> => {
    const data = await getCurrentUser()
    if (!isValidProfile(data)) throw { status: 401, message: 'Invalid profile response' }
    setProfile(data)
    setTokens({ session: 'cookie' })
    loadFollowing(data.id)
    return data
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
    bootstrapSession()
      .catch(() => { setTokens(null); setProfile(null) })
      .finally(() => setSessionResolved(true))
  }, [])

  useEffect(() => {
    const previousBodyBackground = document.body.style.background
    const previousHtmlBackground = document.documentElement.style.background
    if (hasCosmicShell) {
      document.body.style.background = '#030816'
      document.documentElement.style.background = '#030816'
    }
    return () => {
      document.body.style.background = previousBodyBackground
      document.documentElement.style.background = previousHtmlBackground
    }
  }, [hasCosmicShell])

  useEffect(() => {
    if (showFooter) return
    setFooterHeight(0)
  }, [showFooter])

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
      setSessionResolved(true)
      navigate('/login', { replace: true })
      return
    }
    establishSessionWithRetry()
      .then(() => { setError(null); setSessionResolved(true); navigate('/', { replace: true }) })
      .catch(() => { setError({ status: 0, message: 'OAuth login failed' }); setSessionResolved(true); navigate('/login', { replace: true }) })
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
    const me = await establishSession()
    if (me.mustChangePassword && !me.impersonating) {
      navigate('/account/settings?passwordRequired=1')
      return
    }
    const role = (me.role || '').toLowerCase()
    navigate(role === 'admin' || role === 'role_admin' ? '/admin' : '/')
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

  const stopImpersonation = async () => {
    setStoppingImpersonation(true)
    setError(null)
    try {
      await stopImpersonationApi()
      const me = await establishSession()
      const role = (me.role || '').toLowerCase()
      navigate(role === 'admin' || role === 'role_admin' ? '/admin' : '/')
    } catch (err: any) {
      setError(err)
    } finally {
      setStoppingImpersonation(false)
    }
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

  const handleCreateCapsule = async (capsuleData: CreateCapsulePayload): Promise<Capsule> => {
    setError(null)
    const created = await createCapsule(capsuleData)
    await loadCapsules()
    return created
  }

  const viewCapsule = async (id: string) => {
    const normalizedId = safeDecodeSegment(String(id || "")).trim()
    if (!OBJECT_ID_RE.test(normalizedId)) {
      setError({ status: 400, message: 'Invalid capsule id' })
      return
    }
    setError(null)
    try {
      const data = await getCapsule(normalizedId)
      setSelectedCapsule(data)
      navigate(`/capsules/${normalizedId}`, { state: { from: location.pathname } })
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

  // --- WebSocket ---
  // Зберігаємо selectedCapsule у ref щоб мати доступ до актуального значення
  // всередині WS-колбеку без перепідключення при кожному виборі іншої капсули.
  const selectedCapsuleRef = useRef(selectedCapsule)
  useEffect(() => { selectedCapsuleRef.current = selectedCapsule }, [selectedCapsule])

  // WS-з'єднання потрібне на сторінках де є реальний час:
  // - /capsules — автовідкриття капсул (CapsuleUnlockScheduler)
  // - /chat     — отримання повідомлень у реальному часі
  // При виході з цих сторінок — з'єднання закривається.
  const wsNeeded = isAuthenticated && (
    location.pathname === '/capsules' ||
    location.pathname.startsWith('/chat')
  )

  useEffect(() => {
    if (!wsNeeded) return

    // connectCapsuleStream створює SockJS → STOMP CONNECT →
    // підписка на /user/queue/capsules/status (капсули) та /user/queue/chat (чат)
    // onEvent — функція яка НЕ виконується одразу, а лише коли прийде WS-повідомлення
    connectCapsuleStream({
      onEvent: (body: unknown) => {
        // Викликається коли CapsuleUnlockScheduler надішле WS-подію про відкриття капсули
        loadCapsules()
        // Якщо користувач зараз переглядає саме цю капсулу — оновлюємо і її деталі
        const event = body as { id?: string } | null
        const current = selectedCapsuleRef.current
        if (event?.id && current?.id === event.id) {
          getCapsule(event.id).then(setSelectedCapsule).catch(() => {})
        }
      },
      onError: (msg) => console.warn('WS error:', msg),
    })
    // При виході зі сторінок де потрібен WS — закриваємо з'єднання
    return () => disconnectCapsuleStream()
  }, [wsNeeded, loadCapsules])

  // --- Load capsules when navigating to /capsules or /account ---
  useEffect(() => {
    if ((location.pathname === '/capsules' || (location.pathname === '/account' && !isAdmin)) && isAuthenticated) {
      loadCapsules()
    }
  }, [location.pathname, isAuthenticated, isAdmin])

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

  useEffect(() => {
    if (!isAuthenticated || !profile?.mustChangePassword) return
    if (profile?.impersonating) return
    const role = (profile?.role || '').toLowerCase()
    if (role === 'admin' || role === 'role_admin') return
    if (location.pathname === '/account/settings') return
    navigate('/account/settings?passwordRequired=1', { replace: true })
  }, [isAuthenticated, profile?.mustChangePassword, profile?.impersonating, profile?.role, location.pathname, navigate])

  // Direct navigation to /capsules/:id — fetch capsule and surface access errors
  useEffect(() => {
    if (!location.pathname.startsWith('/capsules/')) return
    const [, , rawId] = location.pathname.split('/')
    const id = safeDecodeSegment(rawId || '').trim()
    if (!id) return
    if (!OBJECT_ID_RE.test(id)) {
      setSelectedCapsule(null)
      setError({ status: 400, message: 'Invalid capsule id' })
      return
    }
    if (selectedCapsule?.id === id) return

    let cancelled = false
    setError(null)
    getCapsule(id)
      .then((capsule) => {
        if (!cancelled) setSelectedCapsule(capsule)
      })
      .catch((err: any) => {
        if (!cancelled) {
          setSelectedCapsule(null)
          setError(err)
        }
      })

    return () => {
      cancelled = true
    }
  }, [location.pathname, selectedCapsule?.id])

  // --- Render ---
  return (
    <div
      className={`flex min-h-screen flex-col ${hasCosmicShell ? 'bg-[#030816] text-slate-100' : ''}`}
      style={{
        ['--tc-shell-offset' as any]: shellOffset,
        ['--tc-footer-height' as any]: showFooter ? `${footerHeight}px` : '0px',
      }}
    >
      {!isCosmicConceptRoute && !isAuthRoute && (
        <Header
          isAuthenticated={isAuthenticated}
          onLogout={logout}
          profileRole={profile?.role}
          profile={profile}
          isLanding={hasFixedTopShell}
        />
      )}
      {showImpersonationBanner && (
        <div className="fixed inset-x-0 top-16 z-[45] border-b border-amber-300/35 bg-amber-500/14 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-amber-100 lg:px-6 xl:px-8">
            <p>
              You are viewing as user <span className="font-semibold">{profile?.username || profile?.email}</span>.
            </p>
            <button
              type="button"
              onClick={() => void stopImpersonation()}
              disabled={stoppingImpersonation}
              className="inline-flex items-center gap-2 rounded-md border border-amber-300/45 bg-amber-400/18 px-3 py-1.5 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-400/28 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {stoppingImpersonation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Stop impersonation
            </button>
          </div>
        </div>
      )}
      <main className={`flex-1 ${hasCosmicShell ? 'bg-[#050816]' : ''} ${topShellPaddingClass}`}>
        <Routes>
          <Route path="/landing-concept" element={<CosmicLandingConcept />} />
          <Route path="/landing-concept/account-preview" element={<CosmicLandingConcept />} />

          <Route path="/" element={
            <>
              <HeroSection isAuthenticated={showAuthenticatedLandingLayout} hasFooter={showFooter} />
              {sessionResolved && !isAuthenticated && <HowItWorks />}
              {sessionResolved && !isAuthenticated && <CtaSection />}
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
            isAdmin ? <Navigate to="/admin" replace /> : (profile ? <AccountProfileRoute profile={profile} capsules={capsules} onLoadCapsules={loadCapsules} /> : null)
          } />

          <Route path="/account/settings" element={
            isAdmin ? <Navigate to="/admin" replace /> : <AccountForm profile={profile} onProfileChange={setProfile} onSave={updateProfile} onLogout={logout} />
          } />

          <Route path="/create" element={
            isAdmin ? <Navigate to="/admin" replace /> : <CreateCapsuleForm onSubmit={handleCreateCapsule} error={error} />
          } />

          <Route path="/capsules" element={
            isAdmin ? <Navigate to="/admin" replace /> : <CapsulesList capsules={capsules} isLoading={capsulesLoading} onSelect={viewCapsule} onCreate={() => navigate('/create')} />
          } />

          <Route path="/capsules/:id" element={
             selectedCapsule ? (
               <CapsuleDetail
                 capsule={selectedCapsule}
                 following={following}
                 onBack={() => {
                   const historyIdx = window.history.state?.idx
                   if (typeof historyIdx === "number" && historyIdx > 0) {
                     navigate(-1)
                     return
                   }
                   const fromState = (location.state as { from?: string } | null)?.from
                   navigate(fromState || "/account", { replace: true })
                 }}
                 onUnlock={handleUnlockCapsule}
                 error={error}
                 onRefreshFollowing={() => profile?.id && loadFollowing(profile.id)}
                 isAuthenticated={isAuthenticated}
                 currentUserId={profile?.id}
               />
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
                     onAction={() => navigate((location.state as any)?.from || '/capsules')}
                   />
                 </div>
               </div>
             ) : (
               <div className="mx-auto max-w-2xl px-4 py-10 text-center text-sm text-muted-foreground">Завантаження капсули...</div>
             )
          } />

          <Route path="/search" element={isAdmin ? <Navigate to="/admin" replace /> : <UserSearch currentUserId={profile?.id} />} />

          <Route path="/calendar" element={
            isAdmin ? <Navigate to="/admin" replace /> : <CalendarView onSelectCapsule={viewCapsule} />
          } />

          <Route path="/map" element={
            isAdmin ? <Navigate to="/admin" replace /> : <CapsulesMapView />
          } />

          <Route path="/admin/*" element={
            isAdmin ? <AdminPanel /> : (
              <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
                <div className="w-full max-w-3xl">
                  <EmptyState icon={ShieldOff} title="Access Denied" description="You don't have permission to access the admin panel." actionLabel="Go Home" onAction={() => navigate('/')} />
                </div>
              </div>
            )
          } />

          <Route path="/profile/:username" element={<ProfileRoute currentUserId={profile?.id} />} />

          <Route path="/chat" element={
            isAdmin ? <Navigate to="/admin" replace /> : (
              <ChatWorkspace currentUserId={profile?.id} />
            )
          } />

          <Route path="/chat/:userId" element={isAdmin ? <Navigate to="/admin" replace /> : <ChatRoute currentUserId={profile?.id} />} />

          {/* OAuth redirect handler — handled by useEffect above */}
          <Route path="/auth/oauth2/redirect" element={null} />
        </Routes>
      </main>
      {showFooter && <Footer isLanding={hasCosmicShell} onHeightChange={setFooterHeight} />}
    </div>
  )
}

function ProfileRoute({ currentUserId }: { currentUserId?: string }) {
  const { username } = useParams<{ username: string }>()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [profileFollowers, setProfileFollowers] = useState<UserPublic[]>([])
  const [profileFollowing, setProfileFollowing] = useState<UserPublic[]>([])
  const [profileCapsules, setProfileCapsules] = useState<Capsule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!username) return
    setLoading(true)
    getUserProfile(username)
      .then((profile) => {
        setUserProfile(profile)
        // Load followers, following, and capsules in parallel
        const userId = profile.id
        Promise.allSettled([
          getFollowers(userId).then(setProfileFollowers).catch(() => setProfileFollowers([])),
          getFollowing(userId).then(setProfileFollowing).catch(() => setProfileFollowing([])),
          getUserCapsules(userId).then(data => setProfileCapsules(Array.isArray(data) ? data : [])).catch(() => setProfileCapsules([])),
        ]).finally(() => setLoading(false))
      })
      .catch(() => { setUserProfile(null); setLoading(false) })
  }, [username])

  if (loading) return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>
  if (!userProfile) return <div className="py-24 text-center text-muted-foreground">User not found</div>

  const isOwn = currentUserId === userProfile.id

  // Map UserPublic to UserData format (user-card expects avatar, but backend sends avatarUrl)
  const mapToUserData = (u: UserPublic) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName || u.username,
    avatar: u.avatar || u.avatarUrl,
    bio: u.bio,
    isFollowing: u.isFollowing,
    isOnline: u.isOnline,
    followersCount: u.followersCount,
    followingCount: u.followingCount,
    capsulesCount: u.capsulesCount,
  })

  return (
    <UserProfileView
      user={userProfile}
      isOwnProfile={isOwn}
      capsulesCount={profileCapsules.length}
      followers={profileFollowers.map(mapToUserData)}
      following={profileFollowing.map(mapToUserData)}
      capsules={profileCapsules}
      currentUserId={currentUserId}
    />
  )
}

function AccountProfileRoute({ profile, capsules, onLoadCapsules }: { profile: UserProfile; capsules: Capsule[]; onLoadCapsules: () => Promise<void> }) {
  const [accountFollowers, setAccountFollowers] = useState<UserPublic[]>([])
  const [accountFollowing, setAccountFollowing] = useState<UserPublic[]>([])

  useEffect(() => {
    if (!profile?.id) return
    onLoadCapsules()
    Promise.allSettled([
      getFollowers(profile.id).then(setAccountFollowers).catch(() => setAccountFollowers([])),
      getFollowing(profile.id).then(setAccountFollowing).catch(() => setAccountFollowing([])),
    ])
  }, [profile?.id])

  const mapToUserData = (u: UserPublic) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName || u.username,
    avatar: u.avatar || u.avatarUrl,
    bio: u.bio,
    isFollowing: u.isFollowing,
    isOnline: u.isOnline,
    followersCount: u.followersCount,
    followingCount: u.followingCount,
    capsulesCount: u.capsulesCount,
  })

  return (
    <UserProfileView
      user={profile}
      isOwnProfile
      capsulesCount={capsules.length}
      followers={accountFollowers.map(mapToUserData)}
      following={accountFollowing.map(mapToUserData)}
      capsules={capsules}
      currentUserId={profile.id}
    />
  )
}

function ChatRoute({ currentUserId }: { currentUserId?: string }) {
  const { userId } = useParams<{ userId: string }>()
  if (!userId) return null
  return <ChatWorkspace userId={userId} currentUserId={currentUserId} />
}

function ChatWorkspace({ userId, currentUserId }: { userId?: string; currentUserId?: string }) {
  const navigate = useNavigate()

  return (
    <section className="relative isolate box-border h-[calc(100svh-var(--tc-shell-offset,4rem))] overflow-hidden bg-[#050816] px-3 py-3 sm:px-4 sm:py-4 lg:px-8 lg:py-5">
      <div className="pointer-events-none absolute inset-0 -z-20" aria-hidden="true">
        <SpaceBackgroundFrame className="opacity-[0.16] blur-[1px]" restoreSnapshot startSettled />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.74)_0%,rgba(3,8,20,0.82)_58%,rgba(3,8,22,0.9)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(94,230,255,0.06)_0%,rgba(94,230,255,0)_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_30%,rgba(124,92,255,0.08)_0%,rgba(124,92,255,0)_44%)]" />
      </div>

      <div className="mx-auto h-full w-full max-w-7xl">
        <div className="flex h-full min-h-[440px] w-full overflow-hidden rounded-3xl border border-white/12 bg-slate-950/45 backdrop-blur-xl ring-1 ring-inset ring-white/5 shadow-[0_28px_80px_rgba(2,6,23,0.62)] sm:min-h-[520px]">
          <aside className={`${userId ? 'hidden md:flex' : 'flex'} w-full min-w-0 flex-col bg-[#071022]/45 md:w-[320px] md:border-r md:border-white/12 xl:w-[360px]`}>
            <ChatList selectedUserId={userId} currentUserId={currentUserId} />
          </aside>

          <div className={`${userId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col bg-[#050d20]/35`}>
            {userId ? (
              <ChatWindow userId={userId} currentUserId={currentUserId} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <div className="mb-5 rounded-2xl border border-white/12 bg-white/[0.05] p-4 shadow-[0_0_36px_rgba(124,92,255,0.16)]">
                  <MessageCircle className="h-8 w-8 text-cyan-200" />
                </div>
                <h2 className="font-serif text-2xl font-semibold text-slate-100">Your conversations live here</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
                  Share capsules, send memories, and stay connected through time.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => navigate('/search')}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-300/28 bg-violet-500/85 px-5 py-2.5 text-sm font-semibold text-slate-50 shadow-[0_8px_22px_rgba(84,99,229,0.26)] transition-colors hover:bg-violet-500"
                  >
                    <PenSquare className="h-4 w-4" />
                    Start a new chat
                  </button>
                  <button
                    onClick={() => navigate('/capsules')}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/[0.09]"
                  >
                    <Sparkles className="h-4 w-4 text-cyan-200" />
                    Open capsules
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default App
