import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CtaSection() {
  const navigate = useNavigate()

  return (
    <section className="bg-[linear-gradient(180deg,#060c1d_0%,#050816_100%)] px-4 py-24 text-slate-100 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-slate-950/52 px-6 py-16 text-center backdrop-blur-xl sm:px-16 lg:py-20">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/22 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cyan-400/18 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(248,250,255,0.1)_0%,rgba(248,250,255,0)_48%)]" />
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-xl font-serif text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
              Write it today. Reopen it in the future.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-slate-300">
              Create your first time capsule in under a minute and seal a moment worth reopening.
            </p>
            <div className="mt-8">
              <Button
                size="lg"
                className="h-12 rounded-xl border border-indigo-200/28 bg-[linear-gradient(115deg,#5f58db_0%,#4b78d8_100%)] px-8 text-base font-semibold text-slate-50 shadow-[0_10px_24px_rgba(84,99,229,0.3),0_0_18px_rgba(84,99,229,0.18)] transition-all hover:brightness-105 hover:shadow-[0_14px_30px_rgba(84,99,229,0.36),0_0_24px_rgba(94,230,255,0.18)]"
                onClick={() => navigate('/register')}
              >
                Create Your First Capsule <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <p className="mt-6 text-xs uppercase tracking-[0.12em] text-slate-400">Your memories are sealed in time.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

