import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertBanner } from "@/components/alert-banner"
import { SpaceBackgroundFrame } from "@/components/space-background-frame"
import { ArrowLeft, Loader2, Camera, LogOut, KeyRound, ShieldAlert } from "lucide-react"
import { changeMyPassword, confirmPasswordChangeByCode, requestPasswordChangeCode, uploadAvatarImage, type UserProfile } from "@/services/api"
import { resolveAssetUrl } from "@/lib/asset-url"
import { IMAGE_ACCEPT_ATTR } from "@/lib/media-types"

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
  const [isPasswordCodeSending, setIsPasswordCodeSending] = useState(false)
  const [isPasswordUpdating, setIsPasswordUpdating] = useState(false)
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [isPasswordCodeSent, setIsPasswordCodeSent] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()
  const isForcedPasswordChange = Boolean(profile?.mustChangePassword)
  const passwordEmail = profile?.email?.trim() || ""

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setAvatarError(null)
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

  function resetPasswordForm() {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setVerificationCode("")
    setIsPasswordCodeSent(false)
  }

  function validateNewPassword(): string | null {
    if (!newPassword) {
      return "New password is required"
    }
    if (newPassword.length < 8) {
      return "Password must be at least 8 characters"
    }
    if (newPassword !== confirmPassword) {
      return "Passwords do not match"
    }
    return null
  }

  async function handleChangePassword() {
    setPasswordError(null)
    setPasswordSuccess(null)

    if (!currentPassword.trim()) {
      setPasswordError(isForcedPasswordChange ? "Temporary password is required" : "Current password is required")
      return
    }
    const passwordValidationError = validateNewPassword()
    if (passwordValidationError) {
      setPasswordError(passwordValidationError)
      return
    }

    setIsPasswordUpdating(true)
    try {
      await changeMyPassword({ currentPassword: currentPassword.trim(), newPassword })
      setPasswordSuccess(isForcedPasswordChange ? "Temporary password replaced successfully." : "Password updated successfully.")
      resetPasswordForm()
      if (profile?.mustChangePassword) {
        onProfileChange({ ...profile, mustChangePassword: false })
        navigate("/account/settings", { replace: true })
      }
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to update password")
    } finally {
      setIsPasswordUpdating(false)
    }
  }

  async function handleSendPasswordCode() {
    setPasswordError(null)
    setPasswordSuccess(null)

    if (!passwordEmail) {
      setPasswordError("Email is not set for this account")
      return
    }
    const passwordValidationError = validateNewPassword()
    if (passwordValidationError) {
      setPasswordError(passwordValidationError)
      return
    }

    setIsPasswordCodeSending(true)
    try {
      await requestPasswordChangeCode()
      setIsPasswordCodeSent(true)
      setVerificationCode("")
      setPasswordSuccess(`Verification code sent to ${passwordEmail}.`)
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to send verification code")
    } finally {
      setIsPasswordCodeSending(false)
    }
  }

  async function handleConfirmPasswordByCode() {
    setPasswordError(null)
    setPasswordSuccess(null)

    const passwordValidationError = validateNewPassword()
    if (passwordValidationError) {
      setPasswordError(passwordValidationError)
      return
    }
    if (!verificationCode.trim()) {
      setPasswordError("Verification code is required")
      return
    }

    setIsPasswordUpdating(true)
    try {
      await confirmPasswordChangeByCode({ code: verificationCode.trim(), newPassword })
      setPasswordSuccess("Password updated successfully.")
      resetPasswordForm()
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to update password")
    } finally {
      setIsPasswordUpdating(false)
    }
  }

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !profile) return

    setAvatarError(null)
    setSuccess(false)

    if (file.size > 10 * 1024 * 1024) {
      setAvatarError("File too large. Maximum size is 10MB.")
      return
    }
    if (!file.type.toLowerCase().startsWith("image/")) {
      setAvatarError("Only image files are allowed.")
      return
    }

    setIsAvatarUploading(true)
    try {
      const url = await uploadAvatarImage(file)
      if (!url) {
        throw new Error("Upload completed, but server did not return image URL.")
      }
      onProfileChange({ ...profile, avatarUrl: url })
    } catch (err: any) {
      setAvatarError(err?.message || "Failed to upload avatar")
    } finally {
      setIsAvatarUploading(false)
    }
  }

  const initials = (profile?.username || "U").slice(0, 2).toUpperCase()
  const avatarPreviewUrl = resolveAssetUrl(profile?.avatarUrl)

  return (
    <section className="relative isolate min-h-[calc(100svh-var(--tc-shell-offset,4rem))] overflow-hidden bg-[#09111f] px-4 py-8 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-20" aria-hidden="true">
        <SpaceBackgroundFrame className="opacity-[0.24] blur-[0.8px]" restoreSnapshot startSettled />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,14,34,0.56)_0%,rgba(8,16,36,0.7)_50%,rgba(8,17,38,0.82)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(94,230,255,0.18)_0%,rgba(94,230,255,0)_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(124,92,255,0.2)_0%,rgba(124,92,255,0)_46%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(56,189,248,0.12)_0%,rgba(56,189,248,0)_38%)]" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="mb-6 -ml-3 gap-1.5 text-slate-200 hover:bg-white/[0.12] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Button>

        <div className="rounded-2xl border border-white/18 bg-slate-900/68 p-6 shadow-[0_30px_80px_rgba(6,14,34,0.5)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-100">Account Settings</h1>
              <p className="mt-1 text-sm text-slate-300">Manage your profile information.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="gap-1.5 text-slate-200 hover:bg-rose-400/18 hover:text-rose-100"
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
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-200/40 bg-slate-800 text-lg font-semibold text-white shadow-[0_0_0_6px_rgba(255,255,255,0.03)]">
                  {avatarPreviewUrl ? <img src={avatarPreviewUrl} alt={profile?.username || "avatar"} className="h-full w-full object-cover" /> : initials}
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800/95">
                  <Camera className="h-3.5 w-3.5 text-slate-100" />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-sm font-medium text-slate-200">Profile Photo</Label>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept={IMAGE_ACCEPT_ATTR}
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isAvatarUploading}
                    className="h-10 border-white/20 bg-white/[0.08] text-slate-50 hover:bg-white/[0.14]"
                  >
                    {isAvatarUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    {isAvatarUploading ? "Uploading..." : "Choose Photo"}
                  </Button>
                  {profile?.avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isAvatarUploading}
                      onClick={() => profile && onProfileChange({ ...profile, avatarUrl: "" })}
                      className="h-10 text-slate-200 hover:bg-white/[0.1] hover:text-white"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-400">JPEG, PNG, GIF, WEBP. Max size: 10MB.</p>
                {avatarError && <p className="text-xs text-rose-300">{avatarError}</p>}
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
                  className="h-11 border-white/20 bg-white/[0.08] text-white placeholder:text-slate-300"
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
                  className="h-11 border-white/20 bg-white/[0.08] text-white placeholder:text-slate-300"
                  value={profile?.email || ""}
                  onChange={(e) => onProfileChange({ ...profile!, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                className="h-11 border border-cyan-200/40 bg-cyan-300/22 px-8 text-sm font-semibold text-cyan-50 hover:bg-cyan-300/30"
                disabled={isLoading || isAvatarUploading}
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

          <div className="mt-8 rounded-2xl border border-white/16 bg-white/[0.06] p-5 shadow-[0_18px_48px_rgba(8,15,37,0.26)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
                  <KeyRound className="h-4 w-4 text-cyan-200" />
                  {isForcedPasswordChange ? "Replace Temporary Password" : "Change Password"}
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  {isForcedPasswordChange
                    ? "Enter the temporary password from email and set your own new password."
                    : passwordEmail
                      ? `We'll send a verification code to ${passwordEmail}.`
                      : "Add an email address to confirm password changes by code."}
                </p>
                {isForcedPasswordChange ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-300/35 bg-amber-500/15 px-2.5 py-1 text-xs text-amber-100">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Temporary password active. You must change it now.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    The verification code expires in 15 minutes.
                  </p>
                )}
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
              {isForcedPasswordChange ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pwd-current" className="text-sm font-medium text-slate-100">
                    Temporary Password
                  </Label>
                  <Input
                    id="pwd-current"
                    type="password"
                    autoComplete="current-password"
                    className="h-11 border-white/20 bg-white/[0.08] text-white placeholder:text-slate-300"
                    placeholder="Enter temporary password from email"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pwd-new" className="text-sm font-medium text-slate-100">
                    New Password
                  </Label>
                  <Input
                    id="pwd-new"
                    type="password"
                    autoComplete="new-password"
                    className="h-11 border-white/20 bg-white/[0.08] text-white placeholder:text-slate-300"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="pwd-confirm" className="text-sm font-medium text-slate-100">
                    Confirm Password
                  </Label>
                  <Input
                    id="pwd-confirm"
                    type="password"
                    autoComplete="new-password"
                    className="h-11 border-white/20 bg-white/[0.08] text-white placeholder:text-slate-300"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              {!isForcedPasswordChange && isPasswordCodeSent ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pwd-code" className="text-sm font-medium text-slate-100">
                    Verification Code
                  </Label>
                  <Input
                    id="pwd-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="h-11 border-white/20 bg-white/[0.08] text-white placeholder:text-slate-300"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>
              ) : null}

              {isForcedPasswordChange ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={isPasswordUpdating || !currentPassword.trim() || !newPassword || !confirmPassword}
                    className="h-11 border border-cyan-200/40 bg-cyan-300/22 px-6 text-sm font-semibold text-cyan-50 hover:bg-cyan-300/30"
                  >
                    {isPasswordUpdating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Replace Password"
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap justify-end gap-3">
                  {isPasswordCodeSent ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendPasswordCode}
                      disabled={isPasswordCodeSending || isPasswordUpdating || !newPassword || !confirmPassword}
                      className="h-11 border-white/20 bg-white/[0.06] px-6 text-sm font-semibold text-slate-100 hover:bg-white/[0.12]"
                    >
                      {isPasswordCodeSending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Resend Code"
                      )}
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    onClick={isPasswordCodeSent ? handleConfirmPasswordByCode : handleSendPasswordCode}
                    disabled={
                      isPasswordCodeSending ||
                      isPasswordUpdating ||
                      !newPassword ||
                      !confirmPassword ||
                      !passwordEmail ||
                      (isPasswordCodeSent && !verificationCode.trim())
                    }
                    className="h-11 border border-cyan-200/40 bg-cyan-300/22 px-6 text-sm font-semibold text-cyan-50 hover:bg-cyan-300/30"
                  >
                    {isPasswordCodeSending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : isPasswordUpdating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : isPasswordCodeSent ? (
                      "Confirm Password Change"
                    ) : (
                      "Send Verification Code"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
