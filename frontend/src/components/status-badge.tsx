import { cn } from "@/lib/utils"

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  sealed: { label: "Sealed", className: "bg-info/15 text-info" },
  opened: { label: "Opened", className: "bg-success/15 text-success" },
}

interface StatusBadgeProps {
  status: string
  size?: "sm" | "md"
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft
  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-semibold",
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
      config.className
    )}>
      {config.label}
    </span>
  )
}

