import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, UserIcon, MoonIcon, SunIcon, UploadIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Switch } from '../components/ui/switch'
import { Separator } from '../components/ui/separator'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import blink from '../blink/client'

export default function Settings() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
      if (state.user) {
        loadUserProfile(state.user.id)
      }
    })
    return unsubscribe
  }, [])

  const loadUserProfile = async (userId: string) => {
    try {
      const users = await blink.db.users.list({
        where: { id: userId }
      })
      if (users.length > 0) {
        const userProfile = users[0]
        setDisplayName(userProfile.displayName || '')
        setAvatarUrl(userProfile.avatarUrl || '')
      }
    } catch (error) {
      console.error('Failed to load user profile:', error)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setUploading(true)
    try {
      const { publicUrl } = await blink.storage.upload(
        file,
        `avatars/${user.id}/${file.name}`,
        { upsert: true }
      )
      setAvatarUrl(publicUrl)
      toast.success('Avatar uploaded successfully!')
    } catch (error) {
      console.error('Failed to upload avatar:', error)
      toast.error('Failed to upload avatar')
    } finally {
      setUploading(false)
    }
  }

  const saveProfile = async () => {
    if (!user) return

    setSaving(true)
    try {
      await blink.db.users.update(user.id, {
        displayName: displayName.trim() || user.email.split('@')[0],
        avatarUrl,
        updatedAt: new Date().toISOString()
      })
      toast.success('Profile updated successfully!')
    } catch (error) {
      console.error('Failed to save profile:', error)
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    navigate('/')
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="hover:bg-gray-100 text-gray-700"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-black">Settings</h1>
              <p className="text-sm text-gray-600">Manage your account and preferences</p>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await blink.auth.logout()
                  navigate('/landing')
                } catch (error) {
                  console.error('Failed to logout:', error)
                }
              }}
              className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid gap-8">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-accent" />
                Profile
              </CardTitle>
              <CardDescription>
                Update your profile information and avatar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={avatarUrl} alt="Profile" />
                    <AvatarFallback className="bg-gradient-to-br from-accent/20 to-accent/10 text-accent text-xl font-semibold">
                      {(displayName || user.email)[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute -bottom-2 -right-2 cursor-pointer">
                    <div className="w-8 h-8 bg-accent hover:bg-accent/90 rounded-full flex items-center justify-center transition-colors">
                      {uploading ? (
                        <div className="w-4 h-4 border border-accent-foreground border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <UploadIcon className="w-4 h-4 text-accent-foreground" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium">Profile Picture</h3>
                  <p className="text-sm text-muted-foreground">
                    Click the upload button to change your avatar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Max file size: 5MB. Supported formats: JPG, PNG, GIF
                  </p>
                </div>
              </div>

              <Separator />

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  className="max-w-md"
                />
                <p className="text-sm text-muted-foreground">
                  This is how your name will appear in the chat interface
                </p>
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="max-w-md bg-muted"
                />
                <p className="text-sm text-muted-foreground">
                  Your email address cannot be changed
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={saveProfile}
                  disabled={saving}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {theme === 'dark' ? (
                  <MoonIcon className="w-5 h-5 text-accent" />
                ) : (
                  <SunIcon className="w-5 h-5 text-accent" />
                )}
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-medium">Dark Mode</h3>
                  <p className="text-sm text-muted-foreground">
                    Toggle between light and dark themes
                  </p>
                </div>
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>

              <Separator />

              {/* System Theme */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-medium">Use System Theme</h3>
                  <p className="text-sm text-muted-foreground">
                    Automatically match your system's theme preference
                  </p>
                </div>
                <Switch
                  checked={theme === 'system'}
                  onCheckedChange={(checked) => setTheme(checked ? 'system' : 'light')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>
                Manage your account settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h3 className="font-medium text-destructive">Sign Out</h3>
                  <p className="text-sm text-muted-foreground">
                    Sign out of your account on this device
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => blink.auth.logout()}
                >
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}