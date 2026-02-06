// ============================================
// FILE: components/Header.tsx
// ============================================

'use client'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Menu, X, ShoppingCart, Bell, LogOut, User, Settings, BookOpen, GraduationCap } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { getSecureUrl } from '@/lib/media-url'

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

// Helper to get display URL for avatar
const getAvatarUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_AVATAR;
  // External URLs (like flaticon default) - return as-is
  if (url.includes('flaticon.com') || url.includes('placeholder')) return url;
  // S3 URLs - use secure proxy
  if (url.includes('s3.') || url.includes('amazonaws.com')) {
    return getSecureUrl(url);
  }
  // Already a secure URL or other - return as-is
  return url;
};

interface ProfileData {
  avatar: string | null;
  name: string | null;
  role: string;
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const router = useRouter()
  
  // ✅ Use the hook for instant session detection
  const { data: session, isPending } = authClient.useSession()

  // Fetch profile to get avatar from app_users
  useEffect(() => {
    async function fetchProfile() {
      if (session?.user) {
        try {
          const res = await fetch('/api/user/profile')
          if (res.ok) {
            const { profile: profileData } = await res.json()
            setProfile(profileData)
          }
        } catch (error) {
          console.error('Failed to fetch profile:', error)
        }
      }
    }
    fetchProfile()
  }, [session?.user])

  const handleLogout = async () => {
    await authClient.signOut()
    setProfile(null)
    router.push('/')
    router.refresh()
  }

  // Get avatar URL with priority: profile.avatar > session.user.image > default
  const avatarUrl = getAvatarUrl(profile?.avatar || session?.user?.image)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg font-bold text-primary-foreground">E</span>
            </div>
            <span className="text-xl font-bold">EduPro</span>
          </Link>

          {/* Desktop Nav - Show different items based on auth status */}
          <nav className="hidden md:flex items-center space-x-6">
            {session ? (
              <>
                <Link href="/course">
                  <Button variant="ghost">All Courses</Button>
                </Link>
                <Link href="/my-courses">
                  <Button variant="ghost">
                    <BookOpen className="mr-2 h-4 w-4" />
                    My Courses
                  </Button>
                </Link>
                {/* <Link href="/wishlist">
                  <Button variant="ghost">Wishlist</Button>
                </Link> */}
              </>
            ) : (
              <>
                <Link href="/course">
                  <Button variant="ghost">Explore Courses</Button>
                </Link>
                {/* <Button variant="ghost">Categories</Button>
                <Button variant="ghost">For Business</Button> */}
              </>
            )}
          </nav>

          {/* Search - Desktop (only when logged in) */}
          {session && (
            <div className="hidden lg:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search courses..."
                  className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            {/* Loading State */}
            {isPending && (
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            )}

            {/* Authenticated User */}
            {!isPending && session && (
              <>
                {/* Notifications */}
                <Button variant="ghost" size="icon" className="hidden md:flex relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                </Button>

                {/* Cart */}
                <Link href="/cart">
                  <Button variant="ghost" size="icon" className="hidden md:flex">
                    <ShoppingCart className="h-5 w-5" />
                  </Button>
                </Link>

                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10">
                        <AvatarImage 
                          src={avatarUrl} 
                          alt={session.user?.name || 'User'} 
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{profile?.name || session.user?.name || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">{session.user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        My Profile
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild>
                      <Link href="/my-courses" className="cursor-pointer">
                        <GraduationCap className="mr-2 h-4 w-4" />
                        My Learning
                      </Link>
                    </DropdownMenuItem>
                    
                    {/* <DropdownMenuItem asChild>
                      <Link href="/wishlist" className="cursor-pointer">
                        <BookOpen className="mr-2 h-4 w-4" />
                        Wishlist
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem> */}
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            {/* Guest User - Login/Signup */}
            {!isPending && !session && (
              <div className="flex items-center space-x-2">
                <Link href="/auth/signin">
                  <Button variant="ghost">Log in</Button>
                </Link>
                <Link href="/signup">
                  <Button>Sign up</Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t py-4 md:hidden">
            <nav className="flex flex-col space-y-3">
              {session ? (
                <>
                  {/* Authenticated Mobile Menu */}
                  <Link href="/course" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      All Courses
                    </Button>
                  </Link>
                  <Link href="/my-courses" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <GraduationCap className="mr-2 h-4 w-4" />
                      My Courses
                    </Button>
                  </Link>
                  {/* <Link href="/wishlist" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <BookOpen className="mr-2 h-4 w-4" />
                      Wishlist
                    </Button>
                  </Link> */}
                  <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <User className="mr-2 h-4 w-4" />
                      Dashboard
                    </Button>
                  </Link>
                  <Link href="/profile" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <User className="mr-2 h-4 w-4" />
                      My Profile
                    </Button>
                  </Link>
                  {/* <Link href="/settings" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Button>
                  </Link> */}
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleLogout()
                    }} 
                    className="w-full justify-start text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  {/* Guest Mobile Menu */}
                  <Link href="/course" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      Explore Courses
                    </Button>
                  </Link>
                  <Link href="/auth/signin" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      Log in
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full justify-start">
                      Sign up
                    </Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}