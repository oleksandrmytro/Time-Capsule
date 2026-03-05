import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertBanner } from "@/components/alert-banner"
import { ArrowLeft, Loader2, Camera, LogOut } from "lucide-react"

export function AccountForm({ profile, onProfileChange, onSave, onLogout, onHome }) {
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
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

  const initials = (profile?.username || "U").slice(0, 2).toUpperCase()

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
      <Button variant="ghost" size="sm" onClick={onHome} className="mb-6 gap-1.5 text-muted-foreground -ml-3"><ArrowLeft className="h-4 w-4" /> Home</Button>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-card-foreground">Account Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your profile information.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} className="gap-1.5 text-muted-foreground hover:text-destructive"><LogOut className="h-4 w-4" />Logout</Button>
        </div>

        {success && <AlertBanner type="success" message="Profile updated successfully!" onDismiss={() => setSuccess(false)} />}
        {error && <AlertBanner type="error" message={error.message || 'Update failed'} onDismiss={() => setError(null)} />}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-4">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-border bg-primary text-lg font-semibold text-primary-foreground overflow-hidden">
                {profile?.avatarUrl ? <img src={profile.avatarUrl} alt={profile.username} className="h-full w-full object-cover" /> : initials}
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-secondary"><Camera className="h-3.5 w-3.5 text-muted-foreground" /></div>
            </div>
            <div className="flex-1">
              <Label htmlFor="avatar-url" className="text-sm font-medium">Avatar URL</Label>
              <Input id="avatar-url" type="url" placeholder="https://example.com/avatar.jpg" className="mt-1.5 h-11" value={profile?.avatarUrl || ""} onChange={(e) => onProfileChange({ ...profile, avatarUrl: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="acc-username" className="text-sm font-medium">Username</Label>
              <Input id="acc-username" type="text" className="h-11" value={profile?.username || ""} onChange={(e) => onProfileChange({ ...profile, username: e.target.value })} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="acc-email" className="text-sm font-medium">Email</Label>
              <Input id="acc-email" type="email" className="h-11" value={profile?.email || ""} onChange={(e) => onProfileChange({ ...profile, email: e.target.value })} required />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="h-11 px-8 text-sm font-semibold" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Profile"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

