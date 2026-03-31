import { PenLine, Lock, Sparkles } from "lucide-react"

const steps = [
  { icon: PenLine, step: "01", title: "Create Your Capsule", description: "Write your message, add tags, set visibility and choose who can interact with it." },
  { icon: Lock, step: "02", title: "Seal & Set a Date", description: "Pick an unlock date in the future. Your capsule stays sealed and untouchable until then." },
  { icon: Sparkles, step: "03", title: "Open When Ready", description: "When the unlock date arrives, your capsule opens and delivers your memories to the future." },
]

export function HowItWorks() {
  return (
    <section className="relative border-t border-white/10 bg-[linear-gradient(180deg,#050816_0%,#060c1d_100%)] px-4 py-24 text-slate-100 lg:px-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-[16%] top-10 h-40 w-40 rounded-full bg-violet-500/12 blur-3xl" />
        <div className="absolute bottom-8 right-[12%] h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">How It Works</h2>
          <p className="mt-4 text-slate-300">Three simple steps to preserve your memories for the future.</p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {steps.map((item) => (
            <article key={item.step} className="relative rounded-2xl border border-white/12 bg-white/[0.05] p-7 text-center backdrop-blur-xl transition-colors hover:border-cyan-300/30 hover:bg-white/[0.08]">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-[linear-gradient(135deg,rgba(124,92,255,0.42),rgba(94,230,255,0.28))]">
                <item.icon className="h-7 w-7 text-slate-50" />
              </div>
              <span className="mb-2 block font-mono text-sm font-bold text-cyan-200">Step {item.step}</span>
              <h3 className="mb-2 font-serif text-xl font-semibold text-slate-100">{item.title}</h3>
              <p className="text-sm leading-relaxed text-slate-300">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

