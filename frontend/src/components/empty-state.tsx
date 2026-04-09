import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  appearance?: "default" | "dark"
  actionLabel?: string
  onAction?: () => void
  action?: {
    label: string
    href: string
  }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  appearance = "default",
  actionLabel,
  onAction,
  action,
}: EmptyStateProps) {
  const isDark = appearance === "dark"

  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center ${
      isDark
        ? "border border-cyan-200/12 bg-[#11254f]/62 shadow-[0_24px_70px_rgba(6,18,42,0.34)] backdrop-blur-xl"
        : "border border-dashed border-border bg-muted/30"
    }`}>
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
        isDark ? "border border-cyan-200/18 bg-cyan-300/14" : "bg-secondary"
      }`}>
        <Icon className={`h-7 w-7 ${isDark ? "text-cyan-100" : "text-muted-foreground"}`} />
      </div>
      <h3 className={`mb-2 font-serif text-lg font-semibold ${isDark ? "text-slate-100" : "text-foreground"}`}>{title}</h3>
      <p className={`mb-6 max-w-sm text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-muted-foreground"}`}>{description}</p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className={isDark ? "border border-cyan-300/28 bg-cyan-300/14 text-cyan-50 hover:bg-cyan-300/22" : ""}
        >
          {actionLabel}
        </Button>
      )}
      {action && (
        <Button
          onClick={() => window.location.href = action.href}
          className={isDark ? "border border-cyan-300/28 bg-cyan-300/14 text-cyan-50 hover:bg-cyan-300/22" : ""}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

