import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { OAuthButtons } from "@/components/oauth-buttons"
import { AlertBanner } from "@/components/alert-banner"
import { AuthLayout } from "./auth-layout"
import { Loader2, Mail, Lock } from "lucide-react"

export function LoginForm({ form, onChange, onLogin, onGoHome, onGoRegister, disabled, oauth, error: parentError }) {
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState(null)
  const error = parentError || localError

  async function handleSubmit(e) {
    e.preventDefault()
    setLocalError(null)
    setIsLoading(true)
    try {
      await onLogin()
    } catch (err) {
      setLocalError(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your TimeCapsule account" onHome={onGoHome}>
      <div className="flex flex-col gap-6">
        <OAuthButtons links={oauth} />

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or continue with email</span>
          <Separator className="flex-1" />
        </div>

        {error && (
          <AlertBanner type="error" message={error.message || 'Login failed'} onDismiss={() => setLocalError(null)} />
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" name="email" type="email" placeholder="you@example.com" className="h-11 pl-10" required autoComplete="email" value={form.email} onChange={onChange} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" name="password" type="password" placeholder="Enter your password" className="h-11 pl-10" required autoComplete="current-password" value={form.password} onChange={onChange} />
            </div>
          </div>

          <Button type="submit" className="mt-2 h-11 w-full text-sm font-semibold" disabled={disabled || isLoading}>
            {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : "Login"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {"Don't have an account? "}
          <button onClick={onGoRegister} className="font-medium text-accent underline-offset-4 hover:underline bg-transparent border-none p-0 shadow-none cursor-pointer">
            Create account
          </button>
        </p>
      </div>
    </AuthLayout>
  )
}

