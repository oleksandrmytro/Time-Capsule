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
    <AuthLayout title="Create your account" subtitle="Start preserving your memories today">
      <div className="flex flex-col gap-6">
        <OAuthButtons links={oauth} />

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or create with email</span>
          <Separator className="flex-1" />
        </div>

        {error && (
          <AlertBanner type="error" message={error.message || 'Registration failed'} onDismiss={() => setLocalError(null)} />
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username" className="text-sm font-medium">Username</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="username" name="username" type="text" placeholder="Choose a username" className="h-11 pl-10" required autoComplete="username" value={form.username} onChange={onChange} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-email" className="text-sm font-medium">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="reg-email" name="email" type="email" placeholder="you@example.com" className="h-11 pl-10" required autoComplete="email" value={form.email} onChange={onChange} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="reg-password" name="password" type="password" placeholder="Create a strong password" className="h-11 pl-10" required autoComplete="new-password" value={form.password} onChange={onChange} />
            </div>
          </div>

          <Button type="submit" className="mt-2 h-11 w-full text-sm font-semibold" disabled={disabled || isLoading}>
            {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</>) : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <button onClick={() => navigate('/login')} className="font-medium text-accent underline-offset-4 hover:underline bg-transparent border-none p-0 shadow-none cursor-pointer">
            Login
          </button>
        </p>
      </div>
    </AuthLayout>
  )
}

