import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, X, Timer, User, LogOut, Plus, Search, MessageCircle, CalendarDays, Shield, ChevronDown, Settings } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface HeaderProfileInfo {
  username?: string
  displayName?: string
  avatarUrl?: string
}

interface HeaderProps {
  isAuthenticated: boolean
  onLogout: () => void
  profileRole?: string
  profile?: HeaderProfileInfo | null
  isLanding?: boolean
}

export default function Header({ isAuthenticated, onLogout, profileRole, profile, isLanding = false }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const isAdmin = (profileRole || '').toLowerCase() === 'admin' || (profileRole || '').toUpperCase() === 'ROLE_ADMIN'
  const profileLabel = profile?.displayName || profile?.username || 'Account'
  const profileInitials = profileLabel.slice(0, 2).toUpperCase()
  const headerShellClass = isLanding
    ? 'fixed inset-x-0 top-0 z-50 w-full bg-[#050816]/26 backdrop-blur-md'
    : 'sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl'
  const logoIconClass = isLanding
    ? 'flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-[linear-gradient(135deg,rgba(124,92,255,0.5),rgba(94,230,255,0.35))]'
    : 'flex h-9 w-9 items-center justify-center rounded-lg bg-primary'
  const logoTextClass = isLanding
    ? 'font-serif text-xl font-bold tracking-tight text-slate-100'
    : 'font-serif text-xl font-bold tracking-tight text-foreground'
  const mobileToggleClass = isLanding
    ? 'xl:hidden rounded-lg border border-white/12 bg-black/30 p-2 text-slate-100 hover:bg-black/45'
    : 'xl:hidden p-2 hover:bg-secondary rounded-lg bg-transparent border-none shadow-none'
  const mobileMenuClass = isLanding
    ? 'xl:hidden bg-[#050816]/42 backdrop-blur-lg'
    : 'xl:hidden border-t border-border/50 bg-background'

  const go = (path: string) => {
    setMobileOpen(false)
    navigate(path)
  }

  return (
    <header className={headerShellClass}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6 xl:px-8">
        <button onClick={() => go('/')} className="flex items-center gap-2 bg-transparent border-none p-0 shadow-none hover:opacity-80">
          <div className={logoIconClass}>
            <Timer className={`h-5 w-5 ${isLanding ? 'text-slate-50' : 'text-primary-foreground'}`} />
          </div>
          <span className={logoTextClass}>TimeCapsule</span>
        </button>

        <nav className="hidden items-center gap-1 xl:flex">
          {isAuthenticated ? (
            <>
              {!isAdmin && <NavBtn onClick={() => go('/create')} icon={Plus} landingMode={isLanding}>Create</NavBtn>}
              {!isAdmin && <NavBtn onClick={() => go('/search')} icon={Search} landingMode={isLanding}>Search</NavBtn>}
              {!isAdmin && <NavBtn onClick={() => go('/chat')} icon={MessageCircle} landingMode={isLanding}>Chat</NavBtn>}
              <AccountDropdown
                isAdmin={isAdmin}
                profileLabel={profileLabel}
                profileInitials={profileInitials}
                avatarUrl={profile?.avatarUrl}
                landingMode={isLanding}
                onNavigate={go}
                onLogout={onLogout}
              />
            </>
          ) : (
            <>
              <NavBtn onClick={() => go('/login')} landingMode={isLanding}>Login</NavBtn>
              <NavBtn onClick={() => go('/register')} landingMode={isLanding}>Register</NavBtn>
            </>
          )}
        </nav>

        <button onClick={() => setMobileOpen(!mobileOpen)} className={mobileToggleClass}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className={`${mobileMenuClass} mobile-menu-panel-in`}>
          <div className="flex flex-col gap-1 p-4">
            {isAuthenticated ? (
              <>
                {!isAdmin && <MobileBtn onClick={() => go('/create')} icon={Plus} landingMode={isLanding} delayMs={70}>Create Capsule</MobileBtn>}
                {!isAdmin && <MobileBtn onClick={() => go('/search')} icon={Search} landingMode={isLanding} delayMs={120}>Search Users</MobileBtn>}
                {!isAdmin && <MobileBtn onClick={() => go('/chat')} icon={MessageCircle} landingMode={isLanding} delayMs={170}>Chat</MobileBtn>}
                {isAdmin && <MobileBtn onClick={() => go('/admin')} icon={Shield} landingMode={isLanding} delayMs={20}>Admin Panel</MobileBtn>}
                <div className={`my-2 h-px ${isLanding ? 'bg-white/12' : 'bg-border'}`} />
                {!isAdmin && <MobileBtn onClick={() => go('/account')} icon={User} landingMode={isLanding} delayMs={220}>My Profile</MobileBtn>}
                {!isAdmin && <MobileBtn onClick={() => go('/calendar')} icon={CalendarDays} landingMode={isLanding} delayMs={270}>Calendar</MobileBtn>}
                {!isAdmin && <MobileBtn onClick={() => go('/account/settings')} icon={Settings} landingMode={isLanding} delayMs={320}>Settings</MobileBtn>}
                <button
                  onClick={() => { setMobileOpen(false); onLogout() }}
                  className={`mobile-menu-item-in mt-2 flex w-full items-center gap-2 rounded-lg bg-transparent border-none px-3 py-3 text-left text-sm font-medium transition-colors shadow-none ${isLanding ? 'text-rose-300 hover:bg-rose-400/12' : 'text-destructive hover:bg-destructive/10'}`}
                  style={{ animationDelay: "360ms" }}
                >
                  <LogOut className="h-4 w-4" />Logout
                </button>
              </>
            ) : (
              <>
                <MobileBtn onClick={() => go('/login')} landingMode={isLanding} delayMs={20}>Login</MobileBtn>
                <MobileBtn onClick={() => go('/register')} landingMode={isLanding} delayMs={80}>Register</MobileBtn>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function AccountDropdown({
  isAdmin,
  profileLabel,
  profileInitials,
  avatarUrl,
  landingMode = false,
  onNavigate,
  onLogout,
}: {
  isAdmin: boolean
  profileLabel: string
  profileInitials: string
  avatarUrl?: string
  landingMode?: boolean
  onNavigate: (path: string) => void
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const triggerClass = landingMode
    ? `ml-1 inline-flex items-center gap-2 rounded-xl border border-white/12 px-2.5 py-1.5 text-slate-100 transition-all duration-200 ${open ? 'bg-white/16 ring-1 ring-white/20' : 'bg-white/6 hover:bg-white/12'}`
    : `ml-1 inline-flex items-center gap-2 rounded-xl border border-border/70 px-2.5 py-1.5 text-foreground transition-all duration-200 ${open ? 'bg-secondary/80 ring-1 ring-border' : 'bg-background hover:bg-secondary/70'}`
  const menuClass = landingMode
    ? 'w-56 border-white/12 bg-[#08122c]/96 text-slate-100'
    : 'w-56'
  const itemClass = landingMode
    ? 'gap-2 text-slate-200 focus:bg-white/10 focus:text-slate-50'
    : 'gap-2'

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass}>
          <Avatar className="h-8 w-8 border border-white/20">
            <AvatarImage src={avatarUrl} alt={profileLabel} />
            <AvatarFallback className={landingMode ? 'bg-white/12 text-slate-100 text-xs font-semibold' : 'text-xs font-semibold'}>
              {profileInitials}
            </AvatarFallback>
          </Avatar>
          <span className={`max-w-28 truncate text-sm font-medium ${landingMode ? 'text-slate-100' : 'text-foreground'}`}>{profileLabel}</span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'} ${landingMode ? 'text-slate-300' : 'text-muted-foreground'}`} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={menuClass}>
        {!isAdmin && (
          <DropdownMenuItem
            className={itemClass}
            onSelect={() => {
              onNavigate('/account')
            }}
          >
            <User className="h-4 w-4" />
            My Profile
          </DropdownMenuItem>
        )}
        {!isAdmin && (
          <DropdownMenuItem
            className={itemClass}
            onSelect={() => {
              onNavigate('/calendar')
            }}
          >
            <CalendarDays className="h-4 w-4" />
            Calendar
          </DropdownMenuItem>
        )}
        {!isAdmin && (
          <DropdownMenuItem
            className={itemClass}
            onSelect={() => {
              onNavigate('/account/settings')
            }}
          >
            <Settings className="h-4 w-4" />
            Settings
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem
            className={itemClass}
            onSelect={() => {
              onNavigate('/admin')
            }}
          >
            <Shield className="h-4 w-4" />
            Admin Panel
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={`${itemClass} ${landingMode ? 'text-rose-200 focus:bg-rose-500/20 focus:text-rose-100' : 'text-destructive focus:bg-destructive/10 focus:text-destructive'}`}
          onSelect={() => {
            onLogout()
          }}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NavBtn({
  onClick,
  icon: Icon,
  children,
  landingMode = false,
}: {
  onClick: () => void
  icon?: any
  children: React.ReactNode
  landingMode?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg bg-transparent border-none px-3 py-2 text-sm font-medium shadow-none transition-colors ${landingMode ? 'text-slate-300 hover:bg-white/10 hover:text-slate-100' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
    >
      {Icon && <Icon className="h-4 w-4" />}{children}
    </button>
  )
}

function MobileBtn({
  onClick,
  icon: Icon,
  children,
  landingMode = false,
  delayMs,
}: {
  onClick: () => void
  icon?: any
  children: React.ReactNode
  landingMode?: boolean
  delayMs?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`mobile-menu-item-in flex w-full items-center gap-2 rounded-lg bg-transparent border-none px-3 py-3 text-left text-sm font-medium shadow-none transition-colors ${landingMode ? 'text-slate-300 hover:bg-white/10 hover:text-slate-100' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
      style={delayMs != null ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {Icon && <Icon className="h-4 w-4" />}{children}
    </button>
  )
}
