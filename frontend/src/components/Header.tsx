import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, X, Timer, User, LogOut, Plus, Archive, Search, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  isAuthenticated: boolean
  onAccount: () => void
  onLogout: () => void
  onLoadCapsules?: () => void
}

export default function Header({ isAuthenticated, onAccount, onLogout, onLoadCapsules }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  const go = (path: string) => {
    setMobileOpen(false)
    navigate(path)
  }

  const handleCapsules = () => {
    onLoadCapsules?.()
    go('/capsules')
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        <button onClick={() => go('/')} className="flex items-center gap-2 bg-transparent border-none p-0 shadow-none hover:opacity-80">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Timer className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight text-foreground">TimeCapsule</span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {isAuthenticated ? (
            <>
              <NavBtn onClick={() => go('/')}>Home</NavBtn>
              <NavBtn onClick={handleCapsules} icon={Archive}>My Capsules</NavBtn>
              <NavBtn onClick={() => go('/create')} icon={Plus}>Create</NavBtn>
              <NavBtn onClick={() => go('/search')} icon={Search}>Search</NavBtn>
              <NavBtn onClick={() => go('/chat')} icon={MessageCircle}>Chat</NavBtn>
              <NavBtn onClick={() => { onAccount(); go('/account') }} icon={User}>Profile</NavBtn>
              <Button variant="ghost" size="sm" onClick={onLogout} className="ml-2 gap-1.5 text-muted-foreground hover:text-destructive">
                <LogOut className="h-4 w-4" /><span>Logout</span>
              </Button>
            </>
          ) : (
            <>
              <NavBtn onClick={() => go('/login')}>Login</NavBtn>
              <NavBtn onClick={() => go('/register')}>Register</NavBtn>
            </>
          )}
        </nav>

        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 hover:bg-secondary rounded-lg bg-transparent border-none shadow-none">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border/50 bg-background">
          <div className="flex flex-col gap-1 p-4">
            {isAuthenticated ? (
              <>
                <MobileBtn onClick={() => go('/')}>Home</MobileBtn>
                <MobileBtn onClick={handleCapsules} icon={Archive}>My Capsules</MobileBtn>
                <MobileBtn onClick={() => go('/create')} icon={Plus}>Create Capsule</MobileBtn>
                <MobileBtn onClick={() => go('/search')} icon={Search}>Search Users</MobileBtn>
                <MobileBtn onClick={() => go('/chat')} icon={MessageCircle}>Chat</MobileBtn>
                <MobileBtn onClick={() => { setMobileOpen(false); onAccount(); navigate('/account') }} icon={User}>Profile</MobileBtn>
                <button onClick={() => { setMobileOpen(false); onLogout() }} className="mt-4 flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 bg-transparent border-none shadow-none w-full text-left">
                  <LogOut className="h-4 w-4" />Logout
                </button>
              </>
            ) : (
              <>
                <MobileBtn onClick={() => go('/login')}>Login</MobileBtn>
                <MobileBtn onClick={() => go('/register')}>Register</MobileBtn>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function NavBtn({ onClick, icon: Icon, children }: { onClick: () => void; icon?: any; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground bg-transparent border-none shadow-none">
      {Icon && <Icon className="h-4 w-4" />}{children}
    </button>
  )
}

function MobileBtn({ onClick, icon: Icon, children }: { onClick: () => void; icon?: any; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground bg-transparent border-none shadow-none w-full text-left">
      {Icon && <Icon className="h-4 w-4" />}{children}
    </button>
  )
}

