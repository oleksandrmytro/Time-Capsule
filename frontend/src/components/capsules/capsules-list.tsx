import { useNavigate } from "react-router-dom"
import { CapsuleCard } from "./capsule-card"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Archive, Plus, ArrowLeft } from "lucide-react"
import type { Capsule } from "@/services/api"

interface CapsulesListProps {
  capsules: Capsule[]
  isLoading: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onBack?: () => void
}

export function CapsulesList({ capsules, isLoading, onSelect, onCreate, onBack }: CapsulesListProps) {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-2 gap-1.5 text-muted-foreground -ml-3"><ArrowLeft className="h-4 w-4" /> Home</Button>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">My Capsules</h1>
          <p className="mt-1 text-muted-foreground">Manage and view all your time capsules.</p>
        </div>
        <Button onClick={onCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Create Capsule</Button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map((i) => (<div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"><Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-10 w-full" /></div>))}
          </div>
        ) : capsules.length === 0 ? (
          <EmptyState icon={Archive} title="No capsules yet" description="Create your first time capsule and start preserving memories." actionLabel="Create Capsule" onAction={onCreate} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capsules.map((c) => <CapsuleCard key={c.id} capsule={c} onClick={onSelect} />)}
          </div>
        )}
      </div>
    </div>
  )
}

