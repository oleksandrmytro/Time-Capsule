import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CtaSection() {
  const navigate = useNavigate()

  return (
    <section className="px-4 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center sm:px-16 lg:py-20">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-xl font-serif text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
              Start Preserving Your Memories Today
            </h2>
            <p className="mx-auto mt-4 max-w-md text-primary-foreground/70">
              Create your first time capsule in under a minute. Free to use, always.
            </p>
            <div className="mt-8">
              <Button size="lg" variant="secondary" className="h-12 px-8 text-base font-semibold" onClick={() => navigate('/register')}>
                Create Your First Capsule <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

