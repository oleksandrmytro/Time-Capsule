import { Lock, Globe, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Visibility = "private" | "public" | "shared"

const visibilityConfig: Record<
  Visibility,
  { label: string; icon: typeof Lock; className: string }
> = {
  private: {
    label: "Private",
    icon: Lock,
    className: "bg-muted text-muted-foreground",
  },
  public: {
    label: "Public",
    icon: Globe,
    className: "bg-accent/15 text-accent-foreground",
  },
  shared: {
    label: "Shared",
    icon: Link2,
    className: "bg-info/15 text-info",
  },
}

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const config = visibilityConfig[visibility]
  const Icon = config.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        config.className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}
