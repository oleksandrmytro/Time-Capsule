import { Timer } from "lucide-react"

export function Footer({ onHome }) {
  return (
    <footer className="border-t border-border bg-secondary/30 px-4 py-12 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <button onClick={onHome} className="flex items-center gap-2 bg-transparent border-none p-0 shadow-none hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Timer className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-serif text-lg font-bold text-foreground">TimeCapsule</span>
        </button>
        <p className="text-sm text-muted-foreground">Built with care. Your memories matter.</p>
      </div>
    </footer>
  )
}

