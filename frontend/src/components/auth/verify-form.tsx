import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertBanner } from "@/components/alert-banner"
import { AuthLayout } from "./auth-layout"
import { Loader2, RotateCw } from "lucide-react"
import type { ApiError } from "@/services/api"

interface VerifyFormProps {
  form: { email: string; verificationCode: string }
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onVerify: () => Promise<void>
  onResend: () => Promise<void>
  error: ApiError | null
}

export function VerifyForm({ form, onChange, onVerify, onResend, error: parentError }: VerifyFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [localError, setLocalError] = useState<ApiError | null>(null)
  const [resent, setResent] = useState(false)
  const error = parentError || localError
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (!form.verificationCode || form.verificationCode.length < 6) {
      setLocalError({ status: 0, message: "Please enter the full 6-digit code." })
      return
    }
    setIsLoading(true)
    try {
      await onVerify()
    } catch (err: any) {
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
    } catch (err: any) {
      setLocalError(err)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <AuthLayout title="Unlock your space in time" subtitle="Enter the verification code to open your private capsule.">
      <div className="flex flex-col gap-6">
        <p className="text-center text-sm text-slate-400">
          We sent a 6-digit verification code to your email. Enter it below to verify your account.
        </p>

        {error && <AlertBanner type="error" message={error.message || 'Verification failed'} onDismiss={() => setLocalError(null)} />}
        {resent && <AlertBanner type="info" message="A new verification code has been sent to your email." />}

        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
          <div className="w-full flex flex-col gap-2">
            <Label htmlFor="verificationCode" className="text-center text-sm font-medium text-slate-200">Verification Code</Label>
            <Input
              id="verificationCode"
              name="verificationCode"
              type="text"
              placeholder="Enter 6-digit code"
              className="h-12 rounded-xl border-white/10 bg-white/[0.04] text-center font-mono text-lg tracking-[0.5em] text-slate-50 placeholder:text-slate-400 focus-visible:border-cyan-300/70 focus-visible:ring-[3px] focus-visible:ring-cyan-400/25"
              maxLength={6}
              value={form.verificationCode}
              onChange={onChange}
              required
            />
          </div>

          <Button
            type="submit"
            className="h-12 w-full rounded-xl border border-white/10 bg-[linear-gradient(115deg,#7c5cff_0%,#5ee6ff_100%)] text-sm font-semibold text-slate-950 shadow-[0_12px_36px_rgba(124,92,255,0.4)] transition-all hover:brightness-110 hover:shadow-[0_16px_46px_rgba(94,230,255,0.35)]"
            disabled={isLoading}
          >
            {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>) : "Verify Account"}
          </Button>
        </form>

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={handleResend} disabled={isResending} className="gap-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-slate-100">
            {isResending ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending...</>) : (<><RotateCw className="h-3.5 w-3.5" />Resend code</>)}
          </Button>
        </div>

        <p className="text-center text-sm text-slate-400">
          <button onClick={() => navigate('/login')} className="font-medium text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline bg-transparent border-none p-0 shadow-none cursor-pointer">
            Back to Login
          </button>
        </p>
      </div>
    </AuthLayout>
  )
}

