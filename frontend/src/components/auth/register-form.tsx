import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { OAuthButtons } from "@/components/oauth-buttons"
import { AlertBanner } from "@/components/alert-banner"
import { AuthLayout } from "./auth-layout"
import { Loader2, User, Mail, Lock } from "lucide-react"
import type { OAuthLink, ApiError } from "@/services/api"

interface RegisterFormProps {
  form: { username: string; email: string; password: string }
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSignup: () => Promise<void>
  disabled: boolean
  oauth: OAuthLink[]
  error: ApiError | null
}

export function RegisterForm({ form, onChange, onSignup, disabled, oauth, error: parentError }: RegisterFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<ApiError | null>(null)
  const error = parentError || localError
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    setIsLoading(true)
    try {
      await onSignup()
    } catch (err: any) {
      setLocalError(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout title="Return to your Time Capsule" subtitle="Create your access key to start sealing memories in time.">
      <div className="flex flex-col gap-6">
        <OAuthButtons links={oauth} />

        <div className="flex items-center gap-4">
          <Separator className="flex-1 bg-white/10" />
          <span className="text-xs text-slate-400">or create with email</span>
          <Separator className="flex-1 bg-white/10" />
        </div>

        {error && (
          <AlertBanner type="error" message={error.message || 'Registration failed'} onDismiss={() => setLocalError(null)} />
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username" className="text-sm font-medium text-slate-200">Username</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Choose a username"
                className="h-12 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-slate-50 placeholder:text-slate-400 focus-visible:border-violet-300/70 focus-visible:ring-[3px] focus-visible:ring-violet-400/25"
                required
                autoComplete="username"
                value={form.username}
                onChange={onChange}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-email" className="text-sm font-medium text-slate-200">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="reg-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="h-12 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-slate-50 placeholder:text-slate-400 focus-visible:border-cyan-300/70 focus-visible:ring-[3px] focus-visible:ring-cyan-400/25"
                required
                autoComplete="email"
                value={form.email}
                onChange={onChange}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-password" className="text-sm font-medium text-slate-200">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="reg-password"
                name="password"
                type="password"
                placeholder="Create a strong password"
                className="h-12 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-slate-50 placeholder:text-slate-400 focus-visible:border-violet-300/70 focus-visible:ring-[3px] focus-visible:ring-violet-400/25"
                required
                autoComplete="new-password"
                value={form.password}
                onChange={onChange}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[linear-gradient(115deg,#8b5cf6_0%,#5ee6ff_100%)] text-sm font-semibold text-slate-950 shadow-[0_12px_36px_rgba(124,92,255,0.4)] transition-all hover:brightness-110 hover:shadow-[0_16px_46px_rgba(94,230,255,0.35)]"
            disabled={disabled || isLoading}
          >
            {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</>) : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-400">
          Already have an account?{" "}
          <button onClick={() => navigate('/login')} className="font-medium text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline bg-transparent border-none p-0 shadow-none cursor-pointer">
            Login
          </button>
        </p>
      </div>
    </AuthLayout>
  )
}

