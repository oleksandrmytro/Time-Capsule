import { cn } from "@/lib/utils"

const statusConfig = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  sealed: { label: "Sealed", className: "bg-info/15 text-info" },
  opened: { label: "Opened", className: "bg-success/15 text-success" },
}

export function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.draft
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", config.className)}>
      {config.label}
    </span>
  )
}

