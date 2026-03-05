import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertBanner } from "@/components/alert-banner"
import { AuthLayout } from "./auth-layout"
import { Loader2, RotateCw } from "lucide-react"

export function VerifyForm({ form, onChange, onVerify, onResend, onGoLogin, onGoHome, error: parentError }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [resent, setResent] = useState(false)
  const error = parentError || localError

  async function handleSubmit(e) {
    e.preventDefault()
    setLocalError(null)
    if (!form.verificationCode || form.verificationCode.length < 6) {
      setLocalError({ message: "Please enter the full 6-digit code." })
      return
    }
    setIsLoading(true)
    try {
      await onVerify()
    } catch (err) {
      setLocalError(err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    setIsResending(true)
    setResent(false)
    try {
      await onResend()
      setResent(true)
    } catch (err) {
      setLocalError(err)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <AuthLayout title="Verify your account" subtitle="Enter the code we sent to your email" onHome={onGoHome || onGoLogin}>
      <div className="flex flex-col gap-6">
        <p className="text-center text-sm text-muted-foreground">
          We sent a 6-digit verification code to your email. Enter it below to verify your account.
        </p>

        {error && <AlertBanner type="error" message={error.message || 'Verification failed'} onDismiss={() => setLocalError(null)} />}
        {resent && <AlertBanner type="info" message="A new verification code has been sent to your email." />}

        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
          <div className="w-full flex flex-col gap-2">
            <Label htmlFor="verificationCode" className="text-sm font-medium text-center">Verification Code</Label>
            <Input
              id="verificationCode"
              name="verificationCode"
              type="text"
              placeholder="Enter 6-digit code"
              className="h-12 text-center text-lg tracking-[0.5em] font-mono"
              maxLength={6}
              value={form.verificationCode}
              onChange={onChange}
              required
            />
          </div>

          <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={isLoading}>
            {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>) : "Verify Account"}
          </Button>
        </form>

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={handleResend} disabled={isResending} className="gap-1.5 text-sm text-muted-foreground">
            {isResending ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending...</>) : (<><RotateCw className="h-3.5 w-3.5" />Resend code</>)}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <button onClick={onGoLogin} className="font-medium text-accent underline-offset-4 hover:underline bg-transparent border-none p-0 shadow-none cursor-pointer">
            Back to Login
          </button>
        </p>
      </div>
    </AuthLayout>
  )
}

