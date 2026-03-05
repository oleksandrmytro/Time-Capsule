import { useState } from 'react'
import { Menu, X, Timer, User, LogOut, Plus, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Header({ isAuthenticated, onGo, onAccount, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const close = (fn) => () => { setMobileOpen(false); fn() }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        <button onClick={() => onGo('home')} className="flex items-center gap-2 bg-transparent border-none p-0 shadow-none hover:opacity-80">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Timer className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight text-foreground">TimeCapsule</span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {isAuthenticated ? (
            <>
              <NavBtn onClick={() => onGo('home')}>Home</NavBtn>
              <NavBtn onClick={() => onGo('capsules')} icon={Archive}>My Capsules</NavBtn>
              <NavBtn onClick={() => onGo('createCapsule')} icon={Plus}>Create</NavBtn>
              <NavBtn onClick={onAccount} icon={User}>Account</NavBtn>
              <Button variant="ghost" size="sm" onClick={onLogout} className="ml-2 gap-1.5 text-muted-foreground hover:text-destructive">
                <LogOut className="h-4 w-4" /><span>Logout</span>
              </Button>
            </>
          ) : (
            <>
              <NavBtn onClick={() => onGo('login')}>Login</NavBtn>
              <NavBtn onClick={() => onGo('register')}>Register</NavBtn>
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
                <MobileBtn onClick={close(() => onGo('home'))}>Home</MobileBtn>
                <MobileBtn onClick={close(() => onGo('capsules'))} icon={Archive}>My Capsules</MobileBtn>
                <MobileBtn onClick={close(() => onGo('createCapsule'))} icon={Plus}>Create Capsule</MobileBtn>
                <MobileBtn onClick={close(onAccount)} icon={User}>Account</MobileBtn>
                <button onClick={close(onLogout)} className="mt-4 flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 bg-transparent border-none shadow-none w-full text-left">
                  <LogOut className="h-4 w-4" />Logout
                </button>
              </>
            ) : (
              <>
                <MobileBtn onClick={close(() => onGo('login'))}>Login</MobileBtn>
                <MobileBtn onClick={close(() => onGo('register'))}>Register</MobileBtn>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function NavBtn({ onClick, icon: Icon, children }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground bg-transparent border-none shadow-none">
      {Icon && <Icon className="h-4 w-4" />}{children}
    </button>
  )
}

function MobileBtn({ onClick, icon: Icon, children }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground bg-transparent border-none shadow-none w-full text-left">
      {Icon && <Icon className="h-4 w-4" />}{children}
    </button>
  )
}
