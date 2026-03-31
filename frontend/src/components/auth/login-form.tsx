import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { OAuthButtons } from "@/components/oauth-buttons"
import { AlertBanner } from "@/components/alert-banner"
import { AuthLayout } from "./auth-layout"
import { Loader2, Mail, Lock } from "lucide-react"
import type { OAuthLink, ApiError } from "@/services/api"

interface LoginFormProps {
  form: { email: string; password: string }
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onLogin: () => Promise<void>
  disabled: boolean
  oauth: OAuthLink[]
  error: ApiError | null
}

export function LoginForm({ form, onChange, onLogin, disabled, oauth, error: parentError }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<ApiError | null>(null)
  const error = parentError || localError
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    setIsLoading(true)
    try {
      await onLogin()
    } catch (err: any) {
      setLocalError(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to access your sealed memories and future moments.">
      <div className="flex flex-col gap-6">
        <OAuthButtons links={oauth} />

        <div className="flex items-center gap-4">
          <Separator className="flex-1 bg-white/10" />
          <span className="text-xs text-slate-400">or continue with email</span>
          <Separator className="flex-1 bg-white/10" />
        </div>

        {error && (
          <AlertBanner type="error" message={error.message || 'Login failed'} onDismiss={() => setLocalError(null)} />
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-sm font-medium text-slate-200">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="h-12 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-slate-50 placeholder:text-slate-400 focus-visible:border-violet-300/70 focus-visible:ring-[3px] focus-visible:ring-violet-400/25"
                required
                autoComplete="email"
                value={form.email}
                onChange={onChange}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-sm font-medium text-slate-200">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                className="h-12 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-slate-50 placeholder:text-slate-400 focus-visible:border-cyan-300/70 focus-visible:ring-[3px] focus-visible:ring-cyan-400/25"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={onChange}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[linear-gradient(115deg,#7c5cff_0%,#5ee6ff_100%)] text-sm font-semibold text-slate-950 shadow-[0_12px_36px_rgba(124,92,255,0.4)] transition-all hover:brightness-110 hover:shadow-[0_16px_46px_rgba(94,230,255,0.35)]"
            disabled={disabled || isLoading}
          >
            {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : "Login"}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-400">
          {"Don't have an account? "}
          <button onClick={() => navigate('/register')} className="font-medium text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline bg-transparent border-none p-0 shadow-none cursor-pointer">
            Create account
          </button>
        </p>
      </div>
    </AuthLayout>
  )
}

