import { Timer } from "lucide-react"

export function AuthLayout({ children, title, subtitle, onHome }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <button onClick={onHome} className="mb-6 flex items-center gap-2 bg-transparent border-none p-0 shadow-none hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Timer className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-2xl font-bold text-foreground">TimeCapsule</span>
          </button>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

