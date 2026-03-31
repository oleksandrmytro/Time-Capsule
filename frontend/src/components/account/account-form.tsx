import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertBanner } from "@/components/alert-banner"
import { SpaceBackgroundFrame } from "@/components/space-background-frame"
import { ArrowLeft, Loader2, Camera, LogOut, KeyRound, ShieldAlert } from "lucide-react"
import { changeMyPassword, type UserProfile } from "@/services/api"

interface AccountFormProps {
  profile: UserProfile | null
  onProfileChange: (profile: UserProfile) => void
  onSave: () => Promise<void>
  onLogout: () => void
}

export function AccountForm({ profile, onProfileChange, onSave, onLogout }: AccountFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<any>(null)
  const [isPasswordUpdating, setIsPasswordUpdating] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsLoading(true)
    try {
      await onSave()
      setSuccess(true)
    } catch (err) {
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError(null)
    setPasswordSuccess(null)

    if (!currentPassword.trim()) {
      setPasswordError("Current password is required")
      return
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    setIsPasswordUpdating(true)
    try {
      await changeMyPassword({ currentPassword: currentPassword.trim(), newPassword })
      setPasswordSuccess("Password updated successfully.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      if (profile?.mustChangePassword) {
        onProfileChange({ ...profile, mustChangePassword: false })
      }
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to update password")
    } finally {
      setIsPasswordUpdating(false)
    }
  }

  const initials = (profile?.username || "U").slice(0, 2).toUpperCase()

  return (
    <section className="relative isolate min-h-[calc(100svh-var(--tc-shell-offset,4rem))] overflow-hidden bg-[#050816] px-4 py-8 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-20" aria-hidden="true">
        <SpaceBackgroundFrame className="opacity-[0.16] blur-[1px]" restoreSnapshot startSettled />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.74)_0%,rgba(3,8,20,0.84)_58%,rgba(3,8,22,0.92)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(94,230,255,0.08)_0%,rgba(94,230,255,0)_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(124,92,255,0.1)_0%,rgba(124,92,255,0)_44%)]" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="mb-6 -ml-3 gap-1.5 text-slate-300 hover:bg-white/[0.08] hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Button>

        <div className="rounded-2xl border border-white/14 bg-slate-950/58 p-6 shadow-[0_30px_80px_rgba(2,6,23,0.58)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-100">Account Settings</h1>
              <p className="mt-1 text-sm text-slate-300">Manage your profile information.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="gap-1.5 text-slate-300 hover:bg-rose-500/15 hover:text-rose-200"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>

          {success && <AlertBanner type="success" message="Profile updated successfully!" onDismiss={() => setSuccess(false)} />}
          {error && <AlertBanner type="error" message={error.message || "Update failed"} onDismiss={() => setError(null)} />}

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-300/30 bg-slate-900 text-lg font-semibold text-slate-100">
                  {profile?.avatarUrl ? <img src={profile.avatarUrl} alt={profile.username} className="h-full w-full object-cover" /> : initials}
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-950 bg-slate-900/90">
                  <Camera className="h-3.5 w-3.5 text-slate-300" />
                </div>
              </div>
              <div className="flex-1">
                <Label htmlFor="avatar-url" className="text-sm font-medium text-slate-200">
                  Avatar URL
                </Label>
                <Input
                  id="avatar-url"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  className="mt-1.5 h-11 border-white/14 bg-white/[0.04] text-slate-100 placeholder:text-slate-400"
                  value={profile?.avatarUrl || ""}
                  onChange={(e) => onProfileChange({ ...profile!, avatarUrl: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="acc-username" className="text-sm font-medium text-slate-200">
                  Username
                </Label>
                <Input
                  id="acc-username"
                  type="text"
                  className="h-11 border-white/14 bg-white/[0.04] text-slate-100 placeholder:text-slate-400"
                  value={profile?.username || ""}
                  onChange={(e) => onProfileChange({ ...profile!, username: e.target.value })}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="acc-email" className="text-sm font-medium text-slate-200">
                  Email
                </Label>
                <Input
                  id="acc-email"
                  type="email"
                  className="h-11 border-white/14 bg-white/[0.04] text-slate-100 placeholder:text-slate-400"
                  value={profile?.email || ""}
                  onChange={(e) => onProfileChange({ ...profile!, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                className="h-11 border border-cyan-300/30 bg-cyan-300/14 px-8 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/22"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Profile"
                )}
              </Button>
            </div>
          </form>

          <div className="mt-8 rounded-2xl border border-white/12 bg-white/[0.03] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
                  <KeyRound className="h-4 w-4 text-cyan-200" />
                  Change Password
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Enter current password and set a new one.
                </p>
                {profile?.mustChangePassword ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-300/35 bg-amber-500/15 px-2.5 py-1 text-xs text-amber-100">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Temporary password active. You must change it now.
                  </p>
                ) : null}
              </div>
            </div>

            {passwordSuccess && (
              <div className="mt-4">
                <AlertBanner type="success" message={passwordSuccess} onDismiss={() => setPasswordSuccess(null)} />
              </div>
            )}
            {passwordError && (
              <div className="mt-4">
                <AlertBanner type="error" message={passwordError} onDismiss={() => setPasswordError(null)} />
              </div>
            )}

            <div className="mt-4 grid gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pwd-current" className="text-sm font-medium text-slate-200">
                  Current Password
                </Label>
                <Input
                  id="pwd-current"
                  type="password"
                  autoComplete="current-password"
                  className="h-11 border-white/14 bg-white/[0.04] text-slate-100 placeholder:text-slate-400"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pwd-new" className="text-sm font-medium text-slate-200">
                    New Password
                  </Label>
                  <Input
                    id="pwd-new"
                    type="password"
                    autoComplete="new-password"
                    className="h-11 border-white/14 bg-white/[0.04] text-slate-100 placeholder:text-slate-400"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="pwd-confirm" className="text-sm font-medium text-slate-200">
                    Confirm Password
                  </Label>
                  <Input
                    id="pwd-confirm"
                    type="password"
                    autoComplete="new-password"
                    className="h-11 border-white/14 bg-white/[0.04] text-slate-100 placeholder:text-slate-400"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={isPasswordUpdating || !currentPassword.trim() || !newPassword || !confirmPassword}
                  className="h-11 border border-cyan-300/30 bg-cyan-300/14 px-6 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/22"
                >
                  {isPasswordUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
