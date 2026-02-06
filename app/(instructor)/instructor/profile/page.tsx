'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, Mail, Globe, Clock, Trash2, Camera, Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { getSecureUrl } from '@/lib/media-url'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Profile = {
  name: string
  email: string
  image?: string
  avatar?: string
  bio?: string | null
  phone?: string | null
  country?: string | null
  timezone?: string | null
  role: "student" | "instructor" | "admin"
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

// Helper to get display URL - uses proxy for S3 URLs, direct for others
const getDisplayUrl = (url: string): string => {
  if (!url) return DEFAULT_AVATAR;
  // Data URLs (local preview) - return as-is
  if (url.startsWith('data:')) return url;
  // External URLs (like flaticon default) - return as-is
  if (url.includes('flaticon.com') || url.includes('placeholder')) return url;
  // S3 URLs - use secure proxy
  if (url.includes('s3.') || url.includes('amazonaws.com')) {
    return getSecureUrl(url);
  }
  // Already a secure URL or other - return as-is
  return url;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string>("")
  const [hasAnimated, setHasAnimated] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingAvatar, setDeletingAvatar] = useState(false)
  const [currentAvatarKey, setCurrentAvatarKey] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProfile()
    setTimeout(() => setHasAnimated(true), 100)
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: session } = await authClient.getSession()
      if (!session?.user) throw new Error("Not authenticated")

      const res = await fetch("/api/user/profile")
      if (!res.ok) throw new Error("Failed to load profile")
      const { profile: dbProfile } = await res.json()

      setProfile({
        ...dbProfile,
        email: session.user.email!,
        image: session.user.image || dbProfile.avatar,
      })

      const avatarUrl = dbProfile.avatar || session.user.image || ""
      setAvatarPreview(avatarUrl)
      
      // Extract S3 key from avatar URL if it's from our bucket
      if (avatarUrl && avatarUrl.includes('s3.') && avatarUrl.includes('avatars/')) {
        const key = avatarUrl.split('.com/')[1]
        setCurrentAvatarKey(key || null)
      }
    } catch (err) {
      toast.error("Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const uploadToS3 = async (file: File): Promise<string> => {
    // Get presigned URL from avatar-specific endpoint (allows all users)
    const presignedRes = await fetch('/api/s3/presigned/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }),
    })

    if (!presignedRes.ok) {
      const error = await presignedRes.json()
      throw new Error(error.error || 'Failed to get upload URL')
    }

    const { uploadUrl, fileUrl, key } = await presignedRes.json()

    // Upload directly to S3 using presigned URL
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    })

    if (!uploadRes.ok) {
      throw new Error('Failed to upload file to S3')
    }

    // Store the new key for potential deletion later
    setCurrentAvatarKey(key)

    return fileUrl
  }

  const deleteFromS3 = async (key: string): Promise<void> => {
    try {
      const res = await fetch('/api/s3/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })

      if (!res.ok) {
        console.error('Failed to delete old avatar from S3')
      }
    } catch (error) {
      console.error('Error deleting from S3:', error)
    }
  }

  const updateProfileAvatar = async (avatarUrl: string): Promise<void> => {
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar: avatarUrl }),
    })

    if (!res.ok) {
      throw new Error("Failed to update profile")
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Please upload JPG, PNG, GIF, or WebP')
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 5MB')
      return
    }

    // Show preview immediately
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Upload the file
    setUploadingAvatar(true)
    const oldAvatarKey = currentAvatarKey

    try {
      // Upload new avatar to S3
      const newAvatarUrl = await uploadToS3(file)

      // Update profile in database
      await updateProfileAvatar(newAvatarUrl)

      // Delete old avatar from S3 (if exists and is from our bucket)
      if (oldAvatarKey) {
        await deleteFromS3(oldAvatarKey)
      }

      setAvatarPreview(newAvatarUrl)
      toast.success('Profile photo updated successfully!')
    } catch (err) {
      // Revert preview on error
      setAvatarPreview(profile?.avatar || profile?.image || '')
      setCurrentAvatarKey(oldAvatarKey)
      toast.error(err instanceof Error ? err.message : 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteAvatar = async () => {
    setDeletingAvatar(true)
    try {
      // Delete from S3 if exists
      if (currentAvatarKey) {
        await deleteFromS3(currentAvatarKey)
      }

      // Update profile with default avatar
      await updateProfileAvatar(DEFAULT_AVATAR)

      setAvatarPreview(DEFAULT_AVATAR)
      setCurrentAvatarKey(null)
      toast.success('Profile photo removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove avatar')
    } finally {
      setDeletingAvatar(false)
      setShowDeleteDialog(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const updates = {
      bio: formData.get("bio") as string,
      phone: formData.get("phone") as string,
    }

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (!res.ok) throw new Error("Failed to update profile")

      toast.success("Profile updated successfully!")
      fetchProfile()
    } catch (err) {
      toast.error("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const isDefaultAvatar = !avatarPreview || 
    avatarPreview.includes('flaticon.com') || 
    avatarPreview.includes('placeholder') ||
    avatarPreview === DEFAULT_AVATAR

  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-[60vh] py-10">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4 sm:py-10">
      <div
        className={`mb-8 sm:mb-12 transition-all duration-700 ${hasAnimated ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
      >
        <h1 className="text-heading-3 sm:text-heading-2 lg:text-heading-1 font-bold">
          My Profile
        </h1>
        <p className="text-body-2xlg text-dark-5 dark:text-dark-6 mt-2">
          Manage your personal information and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
        {/* Left: Avatar + Info */}
        <Card
          className={`lg:col-span-1 transition-all duration-700 delay-100 hover:shadow-lg ${hasAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} bg-gray-1 dark:bg-gray-dark border-stroke dark:border-dark-3`}
        >
          <CardContent className="pt-6 sm:pt-8">
            <div className="flex flex-col items-center text-center">
              {/* Avatar with upload/delete options */}
              <div className="relative group mb-6">
                <div 
                  className="absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ 
                    background: 'linear-gradient(to right, var(--color-primary)/20, var(--color-blue-light)/20)'
                  }}
                />
                <Avatar 
                  className="h-28 w-28 sm:h-32 sm:w-32 ring-4 ring-background shadow-xl relative z-10 transition-all duration-300 group-hover:scale-105 group-hover:ring-primary/20"
                  style={{ 
                    boxShadow: 'var(--shadow-card-2)',
                    borderColor: 'var(--color-stroke)'
                  }}
                >
                  <AvatarImage src={getDisplayUrl(avatarPreview)} className="object-cover" />
                  <AvatarFallback 
                    className="text-2xl sm:text-3xl text-white font-bold"
                    style={{ 
                      background: 'linear-gradient(135deg, var(--color-primary), var(--color-blue-light))'
                    }}
                  >
                    {profile?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Upload overlay */}
                {uploadingAvatar ? (
                  <div 
                    className="absolute inset-0 flex items-center justify-center backdrop-blur-sm rounded-full z-20"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
                  >
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  </div>
                ) : (
                  <label 
                    className="absolute inset-0 flex items-center justify-center backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer z-20 scale-95 group-hover:scale-100"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Camera className="h-6 w-6 sm:h-8 sm:w-8 text-white transform group-hover:-translate-y-0.5 transition-transform" />
                      <span className="text-xs text-white/90 font-medium">Change</span>
                    </div>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/jpeg,image/png,image/gif,image/webp" 
                      onChange={handleAvatarChange} 
                      className="hidden" 
                    />
                  </label>
                )}
              </div>

              {/* Avatar action buttons */}
              <div className="flex items-center gap-2 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs border-stroke dark:border-dark-3 hover:bg-primary hover:text-white hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  Upload Photo
                </Button>
                {!isDefaultAvatar && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs border-stroke dark:border-dark-3 hover:bg-red hover:text-white hover:border-red transition-colors"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={uploadingAvatar || deletingAvatar}
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </Button>
                )}
              </div>

              <p className="text-xs text-dark-6 mb-4">
                JPG, PNG, GIF or WebP. Max 5MB.
              </p>

              <h2 className="text-xl sm:text-2xl font-bold mb-1 transition-colors hover:text-primary">
                {profile?.name}
              </h2>
              <div 
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs sm:text-sm font-medium capitalize mb-3 transition-all hover:bg-primary/20 bg-primary/10 text-primary"
              >
                <div className="h-2 w-2 rounded-full animate-pulse bg-primary" />
                {profile?.role}
              </div>
              <p className="text-xs sm:text-sm flex items-center gap-2 text-dark-5 hover:text-foreground transition-colors">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate max-w-[200px]">{profile?.email}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Right: Editable Fields */}
        <Card
          className={`lg:col-span-2 transition-all duration-700 delay-200 hover:shadow-lg ${hasAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} bg-gray-1 dark:bg-gray-dark border-stroke dark:border-dark-3`}
        >
          <CardHeader className="space-y-1">
            <CardTitle className="text-heading-6 sm:text-heading-5">
              Edit Profile
            </CardTitle>
            <CardDescription className="text-body-sm text-dark-5 dark:text-dark-6">
              Update your personal information and make changes to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-body-sm font-medium">
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  name="bio"
                  placeholder="Tell us about yourself..."
                  defaultValue={profile?.bio || ""}
                  rows={4}
                  className="resize-none transition-all duration-200 focus:ring-2 hover:border-primary/50 border-stroke dark:border-dark-3 bg-transparent text-dark dark:text-white dark:bg-dark-2"
                  style={{ 
                    '--tw-ring-color': 'var(--color-primary) / 0.2'
                  } as React.CSSProperties}
                />
                <p className="text-body-xs text-dark-5 dark:text-dark-6">
                  Brief description for your profile. Max 200 characters.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-body-sm font-medium">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  defaultValue={profile?.phone || ""}
                  className="transition-all duration-200 focus:ring-2 hover:border-primary/50 border-stroke dark:border-dark-3 bg-transparent text-dark dark:text-white dark:bg-dark-2"
                  style={{ 
                    '--tw-ring-color': 'var(--color-primary) / 0.2'
                  } as React.CSSProperties}
                />
              </div>

              {/* Read-only info */}
              <div className="space-y-3 pt-6 border-t border-stroke dark:border-dark-3">
                <h3 className="text-body-sm font-semibold mb-4">
                  Account Information
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-muted group bg-gray-2 dark:bg-dark-2">
                    <div 
                      className="p-2 rounded-md shadow-sm group-hover:shadow transition-shadow bg-gray-1 dark:bg-dark-3"
                      style={{ boxShadow: 'var(--shadow-card)' }}
                    >
                      <Globe className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-xs font-medium uppercase tracking-wide text-dark-5">
                        Country
                      </p>
                      <p className="text-body-sm font-medium mt-0.5 truncate text-dark dark:text-white">
                        {profile?.country || "Not set"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-muted group bg-gray-2 dark:bg-dark-2">
                    <div 
                      className="p-2 rounded-md shadow-sm group-hover:shadow transition-shadow bg-gray-1 dark:bg-dark-3"
                      style={{ boxShadow: 'var(--shadow-card)' }}
                    >
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-xs font-medium uppercase tracking-wide text-dark-5">
                        Timezone
                      </p>
                      <p className="text-body-sm font-medium mt-0.5 truncate text-dark dark:text-white">
                        {profile?.timezone?.replace(/_/g, " ") || "Not set"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  size="lg"
                  disabled={saving}
                  className="w-full sm:w-auto min-w-[140px] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden group bg-primary hover:bg-primary/90 text-white"
                >
                  <span 
                    className="absolute inset-0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"
                    style={{ 
                      background: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)'
                    }}
                  />
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Delete Avatar Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-gray-1 dark:bg-gray-dark border-stroke dark:border-dark-3">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-dark dark:text-white">
              Remove Profile Photo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-dark-5 dark:text-dark-6">
              This will remove your current profile photo and replace it with a default avatar. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-stroke dark:border-dark-3 hover:bg-gray-2 dark:hover:bg-dark-2"
              disabled={deletingAvatar}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAvatar}
              disabled={deletingAvatar}
              className="bg-red hover:bg-red-dark text-white"
            >
              {deletingAvatar ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Removing...
                </>
              ) : (
                'Remove Photo'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}