'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Upload, X, Loader2, BookOpen, Briefcase } from 'lucide-react'
import { countries as countriesData, type ICountry } from 'countries-list'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

const countries = Object.entries(countriesData)
  .map(([code, country]) => ({ code, ...(country as ICountry) }))
  .sort((a, b) => a.name.localeCompare(b.name))

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [role, setRole] = useState<'student' | 'instructor'>('student')
  const [avatarUrl, setAvatarUrl] = useState<string>(DEFAULT_AVATAR)
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('')
  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const router = useRouter()

  const selectedCountry = countries.find(c => c.code === selectedCountryCode)

  const uploadToS3 = async (file: File) => {
    setUploading(true)
    try {
      const res = await fetch('/api/s3/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      })

      if (!res.ok) throw new Error('Failed to get upload URL')

      const { presignedUrl, url, key } = await res.json()

      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!uploadRes.ok) throw new Error('Upload failed')

      setAvatarUrl(url)
      setCurrentKey(key)
      toast.success('Avatar uploaded!')
    } catch (err) {
      toast.error('Failed to upload avatar')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarUrl(reader.result as string)
    }
    reader.readAsDataURL(file)

    uploadToS3(file)
  }

  const removeAvatar = async () => {
    if (!currentKey) {
      setAvatarUrl(DEFAULT_AVATAR)
      setCurrentKey(null)
      return
    }

    try {
      const res = await fetch('/api/s3/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: currentKey }),
      })

      if (!res.ok) throw new Error()

      toast.success('Avatar removed')
      setAvatarUrl(DEFAULT_AVATAR)
      setCurrentKey(null)
    } catch {
      toast.error('Failed to remove avatar')
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!phoneNumber) {
      toast.error('Phone number is required')
      return
    }

    setLoading(true)

    const formData = new FormData(e.currentTarget)

    const payload = {
      name: formData.get('name') as string,
      role,
      bio: (formData.get('bio') as string) || null,
      phone: phoneNumber,
      country: selectedCountry?.name || null,
      timezone: null,
      avatar: avatarUrl === DEFAULT_AVATAR ? null : avatarUrl,
    }

    try {
     const res = await fetch('/api/profile/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save profile');
      }

      const data = await res.json();
      toast.success('Welcome! Your profile is ready')
      router.push(data.redirectTo || "/dashboard");
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background to-primary/5 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold">Complete Your Profile</h1>
          <p className="text-lg text-muted-foreground mt-3">Let&apos;s get to know you</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-8 bg-card border rounded-3xl p-8 md:p-12 shadow-2xl">
          {/* Avatar Upload */}
          <div className="flex justify-center">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-border shadow-lg">
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
                {uploading && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-full">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <label className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-3 shadow-lg cursor-pointer hover:bg-primary/90 transition">
                <Upload className="h-5 w-5" />
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={uploading}
                  suppressHydrationWarning
                />
              </label>

              {/* Remove Button */}
              {avatarUrl !== DEFAULT_AVATAR && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="absolute top-0 right-0 bg-destructive text-white rounded-full p-2 shadow-lg hover:bg-destructive/90 transition -translate-y-1 translate-x-1"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Name & Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="John Doe"
                required
                disabled={loading}
                className="mt-2 h-12"
                suppressHydrationWarning
              />
            </div>

            <div suppressHydrationWarning>
              <Label htmlFor="phone">Phone Number *</Label>
              <PhoneInput
                international
                defaultCountry="BD"
                value={phoneNumber}
                onChange={(value) => setPhoneNumber(value || '')}
                disabled={loading}
                className="mt-2 h-12 flex items-center border border-input rounded-md px-3 bg-background"
                placeholder="+880 1234 567890"
              />
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <Label>I want to join as...</Label>
            <div className="grid grid-cols-2 gap-6 mt-6">
              {(['student', 'instructor'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`p-10 rounded-2xl border-2 transition-all ${
                    role === r
                      ? 'border-primary bg-primary/10 shadow-xl scale-105'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {r === 'student' ? (
                    <BookOpen className="h-16 w-16 mx-auto mb-4 text-primary" />
                  ) : (
                    <Briefcase className="h-16 w-16 mx-auto mb-4 text-primary" />
                  )}
                  <div className="text-2xl font-bold capitalize">{r}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="bio">Bio (Optional)</Label>
            <Textarea
              id="bio"
              name="bio"
              placeholder="Tell us about yourself..."
              rows={4}
              disabled={loading}
              className="mt-2"
              suppressHydrationWarning
            />
          </div>

          <div suppressHydrationWarning>
            <Label>Country</Label>
            <Select value={selectedCountryCode} onValueChange={setSelectedCountryCode}>
              <SelectTrigger className="mt-2 h-12">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                     {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-lg font-bold"
            disabled={loading || uploading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              'Start Learning'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}