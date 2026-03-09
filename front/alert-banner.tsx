import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

type AlertType = "error" | "success" | "info"

const alertConfig: Record<
  AlertType,
  { icon: typeof AlertCircle; className: string }
> = {
  error: {
    icon: AlertCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  success: {
    icon: CheckCircle2,
    className: "border-success/30 bg-success/10 text-success",
  },
  info: {
    icon: Info,
    className: "border-info/30 bg-info/10 text-info",
  },
}

interface AlertBannerProps {
  type: AlertType
  message: string
  onDismiss?: () => void
}

export function AlertBanner({ type, message, onDismiss }: AlertBannerProps) {
  const config = alertConfig[type]
  const Icon = config.icon
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        config.className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
