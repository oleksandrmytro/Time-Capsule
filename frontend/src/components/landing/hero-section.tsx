import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ArrowRight, Timer, Shield, Clock, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface HeroSectionProps {
  isAuthenticated: boolean
  onLoadCapsules?: () => void
}

export function HeroSection({ isAuthenticated, onLoadCapsules }: HeroSectionProps) {
  const navigate = useNavigate()

  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-20 lg:px-8 lg:pb-32 lg:pt-28">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] translate-x-1/4 translate-y-1/4 rounded-full bg-primary/5 blur-3xl" />
      </div>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-sm text-muted-foreground">
            <Timer className="h-4 w-4 text-accent" />
            <span>Preserve memories. Deliver the future.</span>
          </div>
          <h1 className="text-balance font-serif text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Your Messages,{" "}
            <span className="text-accent">Delivered When the Time Is Right</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Create digital time capsules filled with messages and memories. Seal them today, set an unlock date, and let the future surprise you.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {isAuthenticated ? (
              <>
                <Button size="lg" className="h-12 px-8 text-base font-semibold" onClick={() => navigate('/create')}>
                  Create Capsule <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" size="lg" className="h-12 px-8 text-base font-semibold" onClick={async () => { onLoadCapsules?.(); navigate('/capsules') }}>
                  My Capsules
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" className="h-12 px-8 text-base font-semibold" onClick={() => navigate('/register')}>
                  Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" size="lg" className="h-12 px-8 text-base font-semibold" onClick={() => navigate('/login')}>
                  Sign In
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-24 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={Clock} title="Time-Locked Messages" description="Set a future unlock date and your capsule stays sealed until the moment arrives. Build anticipation." />
          <FeatureCard icon={Shield} title="Private & Secure" description="Control who sees your capsules. Keep them private, share with a link, or make them public." />
          <FeatureCard icon={Users} title="Share With Anyone" description="Generate unique share links for your capsules. Let friends and family join in on the memories." />
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10">
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <h3 className="mb-2 font-serif text-lg font-semibold text-card-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

