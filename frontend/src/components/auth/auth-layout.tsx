import { LockKeyhole, Timer } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { SpaceBackgroundFrame } from "@/components/space-background-frame"
import "./auth-layout.css"

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle: string
  onHome?: () => void
}

export function AuthLayout({ children, title, subtitle, onHome }: AuthLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleHome = () => {
    if (onHome) onHome()
    navigate('/')
  }

  return (
    <div className="auth-shell">
      <div className="auth-background" aria-hidden="true">
        <SpaceBackgroundFrame className="auth-space-canvas" restoreSnapshot startSettled />
        <div className="auth-space-overlay" />
        <div className="auth-vignette" />
        <div className="auth-particles" />
      </div>

      <div className="auth-content">
        <header className="auth-topbar">
          <button onClick={handleHome} className="auth-logo-button" type="button" aria-label="Go home">
            <span className="auth-logo-icon">
              <Timer className="h-4 w-4" />
            </span>
            <span className="auth-logo-text">TimeCapsule</span>
          </button>

          <nav className="auth-top-nav" aria-label="Authentication pages">
            <Link
              to="/login"
              className={cn("auth-top-link", location.pathname === "/login" && "is-active")}
            >
              Login
            </Link>
            <Link
              to="/register"
              className={cn("auth-top-link", location.pathname === "/register" && "is-active")}
            >
              Register
            </Link>
          </nav>
        </header>

        <main className="auth-stage">
          <div className="auth-card-wrap">
            <span className="auth-card-glow" aria-hidden="true" />
            <span className="auth-card-orbit auth-card-orbit-outer" aria-hidden="true" />
            <span className="auth-card-orbit auth-card-orbit-inner" aria-hidden="true" />

            <section className="auth-card">
              <div className="auth-card-kicker">
                <span className="auth-card-kicker-icon">
                  <LockKeyhole className="h-3.5 w-3.5" />
                </span>
                <span>Capsule Access</span>
              </div>
              <h1 className="auth-card-title">{title}</h1>
              <p className="auth-card-subtitle">{subtitle}</p>
              <div className="auth-card-body">{children}</div>
            </section>
          </div>
        </main>

        <footer className="auth-footer">
          Built for memories that matter.
        </footer>
      </div>
    </div>
  )
}

