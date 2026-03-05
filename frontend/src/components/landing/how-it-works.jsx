import { PenLine, Lock, Sparkles } from "lucide-react"

const steps = [
  { icon: PenLine, step: "01", title: "Create Your Capsule", description: "Write your message, add tags, set visibility and choose who can interact with it." },
  { icon: Lock, step: "02", title: "Seal & Set a Date", description: "Pick an unlock date in the future. Your capsule stays sealed and untouchable until then." },
  { icon: Sparkles, step: "03", title: "Open When Ready", description: "When the unlock date arrives, your capsule opens and delivers your memories to the future." },
]

export function HowItWorks() {
  return (
    <section className="border-t border-border bg-secondary/30 px-4 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">How It Works</h2>
          <p className="mt-4 text-muted-foreground">Three simple steps to preserve your memories for the future.</p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {steps.map((item) => (
            <div key={item.step} className="relative text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                <item.icon className="h-7 w-7 text-primary-foreground" />
              </div>
              <span className="mb-2 block font-mono text-sm font-bold text-accent">Step {item.step}</span>
              <h3 className="mb-2 font-serif text-xl font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

