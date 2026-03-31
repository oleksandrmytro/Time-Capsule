import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ArrowRight, CalendarDays, Clock3, MapPin, Shield, Tag, Timer, Users2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { SpaceBackgroundFrame } from "@/components/space-background-frame"

interface HeroSectionProps {
  isAuthenticated: boolean
  hasFooter?: boolean
}

export function HeroSection({ isAuthenticated, hasFooter = false }: HeroSectionProps) {
  const navigate = useNavigate()
  const heroHeightClass = hasFooter
    ? "min-h-[calc(100svh-var(--tc-shell-offset,4rem))] lg:h-[calc(100dvh-var(--tc-shell-offset,4rem))] lg:min-h-0"
    : "min-h-[calc(100svh-var(--tc-shell-offset,4rem))]"
  const sectionClassName = isAuthenticated
    ? `relative isolate overflow-hidden bg-[#050816] px-4 py-4 text-slate-100 ${heroHeightClass} lg:px-8`
    : `relative isolate overflow-hidden bg-[#050816] px-4 text-slate-100 ${heroHeightClass} lg:px-8`
  const containerClassName = isAuthenticated
    ? "mx-auto flex h-full max-w-7xl flex-col justify-center py-4 sm:py-5"
    : "mx-auto flex h-full max-w-7xl flex-col justify-center py-8 lg:py-12"
  const featuresSpacingClass = isAuthenticated ? "mt-10 md:mt-12" : "mt-14"

  return (
    <section className={sectionClassName}>
      <div className="pointer-events-none absolute inset-0 -z-20" aria-hidden="true">
        <SpaceBackgroundFrame className="opacity-[0.46]" restoreSnapshot startSettled />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.42)_0%,rgba(3,8,20,0.58)_58%,rgba(3,8,22,0.74)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_32%,rgba(124,92,255,0.17)_0%,rgba(124,92,255,0)_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_82%,rgba(94,230,255,0.14)_0%,rgba(94,230,255,0)_46%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,0,0)_48%,rgba(2,6,23,0.48)_100%)]" />
      </div>

      <div className={containerClassName}>
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:gap-16">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/16 bg-slate-950/45 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md sm:mb-6 sm:px-4 sm:text-sm">
              <Timer className="h-3.5 w-3.5 text-cyan-300 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Share moments</span>
              <span className="hidden sm:inline">Share your moments</span>
            </div>
            <h1 className="text-balance font-serif text-3xl font-bold leading-[1.06] tracking-tight text-slate-50 sm:text-4xl md:text-5xl lg:text-6xl">
              Seal memories in time.
              <span className="mt-2 block bg-[linear-gradient(115deg,#8b5cf6_12%,#5ee6ff_92%)] bg-clip-text text-transparent">
                Open them when the moment comes.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-300 sm:mt-6 sm:text-lg">
              Write it today, lock it for the future, and reopen your words exactly when they matter most.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:gap-4">
              {isAuthenticated ? (
                <>
                  <Button
                    size="lg"
                    className="h-12 w-full justify-center rounded-xl border border-indigo-200/28 bg-[linear-gradient(115deg,#5f58db_0%,#4b78d8_100%)] px-6 text-sm font-semibold text-slate-50 shadow-[0_10px_24px_rgba(84,99,229,0.3),0_0_18px_rgba(84,99,229,0.18)] transition-all hover:brightness-105 hover:shadow-[0_14px_30px_rgba(84,99,229,0.36),0_0_24px_rgba(94,230,255,0.18)] sm:w-auto sm:px-8 sm:text-base"
                    onClick={() => navigate('/create')}
                  >
                    Create Capsule <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="h-12 w-full justify-center rounded-xl border border-indigo-200/28 bg-[linear-gradient(115deg,#5f58db_0%,#4b78d8_100%)] px-6 text-sm font-semibold text-slate-50 shadow-[0_10px_24px_rgba(84,99,229,0.3),0_0_18px_rgba(84,99,229,0.18)] transition-all hover:brightness-105 hover:shadow-[0_14px_30px_rgba(84,99,229,0.36),0_0_24px_rgba(94,230,255,0.18)] sm:w-auto sm:px-8 sm:text-base"
                    onClick={() => navigate('/register')}
                  >
                    Start Sealing Memories <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 w-full justify-center rounded-xl border-white/18 bg-white/[0.03] px-6 text-sm font-semibold text-slate-100 backdrop-blur-md shadow-[0_0_0_rgba(94,230,255,0)] transition-all hover:border-cyan-300/45 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_24px_rgba(94,230,255,0.2)] sm:w-auto sm:px-8 sm:text-base"
                    onClick={() => navigate('/login')}
                  >
                    Sign In
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[470px] lg:ml-auto lg:mr-0 lg:max-w-[470px]">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-400/28 blur-[90px]" />
            <article className="relative overflow-hidden rounded-3xl border border-white/16 bg-slate-950/46 p-5 backdrop-blur-xl shadow-[0_28px_90px_rgba(2,6,23,0.78)] sm:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(248,250,255,0.12)_0%,rgba(248,250,255,0)_48%)]" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300/90">Capsule Preview</p>
                  <span className="rounded-full border border-emerald-300/28 bg-emerald-400/12 px-3 py-1 text-xs font-medium text-emerald-200">
                    Sealed
                  </span>
                </div>
                <h3 className="mt-4 font-serif text-2xl font-semibold text-slate-50">Letter to Future Me</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  "If you are reading this, you made it through another chapter. Remember why you started."
                </p>

                <div className="mt-6 space-y-3">
                  <PreviewRow icon={CalendarDays} label="Unlock date" value="October 7, 2029" />
                  <PreviewRow icon={MapPin} label="Location" value="Budapest, Hungary" />
                  <PreviewRow icon={Tag} label="Tags" value="#future #milestone #personal" />
                </div>
              </div>
            </article>
          </div>
        </div>

        <div className={`${featuresSpacingClass} grid w-full gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-6`}>
          <FeatureCard icon={Clock3} title="Time-Locked Capsules" description="Seal a message today and unlock it only when the chosen date arrives." tone="violet" />
          <FeatureCard icon={Shield} title="Private by Design" description="Keep memories personal, share only with trusted people, or publish intentionally." tone="cyan" />
          <FeatureCard icon={Users2} title="Shared Milestones" description="Invite family and friends to reopen moments together at the right time." tone="blue" />
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: LucideIcon
  title: string
  description: string
  tone: "violet" | "cyan" | "blue"
}) {
  const toneStyle: Record<"violet" | "cyan" | "blue", string> = {
    violet: "from-violet-400/35 to-violet-500/10 text-violet-200 shadow-violet-500/18",
    cyan: "from-cyan-300/30 to-cyan-500/8 text-cyan-200 shadow-cyan-400/18",
    blue: "from-sky-400/28 to-blue-500/8 text-sky-200 shadow-blue-500/18",
  }

  return (
    <article className="group rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-cyan-300/35 hover:bg-white/[0.08] hover:shadow-[0_20px_50px_rgba(30,41,59,0.55)] sm:p-6">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${toneStyle[tone]} shadow-[0_10px_28px]`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-2 font-serif text-lg font-semibold text-slate-100">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-300">{description}</p>
    </article>
  )
}

function PreviewRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <Icon className="h-4 w-4 text-cyan-200" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="truncate text-sm text-slate-200">{value}</p>
      </div>
    </div>
  )
}
