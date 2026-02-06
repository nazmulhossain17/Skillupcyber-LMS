// ============================================
// FILE: components/admin/Header/user-info.tsx
// ============================================

"use client";

import { ChevronUpIcon } from "@/assets/icons";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOutIcon, SettingsIcon, UserIcon } from "./usericon";
import { authClient } from "@/lib/auth-client";
import { getSecureUrl } from "@/lib/media-url";

type SessionData = Awaited<ReturnType<typeof authClient.getSession>>['data']

type ProfileData = {
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
}

const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

export function UserInfo() {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<SessionData>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchSessionAndProfile() {
      try {
        // Fetch session
        const result = await authClient.getSession();
        setSession(result.data);
        
        // If we have a session, fetch the profile for the avatar
        if (result.data?.user) {
          const profileRes = await fetch("/api/user/profile");
          if (profileRes.ok) {
            const { profile: profileData } = await profileRes.json();
            setProfile(profileData);
          }
        }
      } catch (error) {
        console.error("Failed to fetch session/profile:", error);
        setSession(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    fetchSessionAndProfile();
  }, []);
  
  const handleLogout = async () => {
    await authClient.signOut();
    window.location.href = '/';
  };

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

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="size-12 animate-pulse rounded-full bg-gray-3 dark:bg-dark-3" />
        <div className="h-4 w-24 animate-pulse rounded bg-gray-3 dark:bg-dark-3 max-[1024px]:hidden" />
      </div>
    );
  }

  // If no session, redirect to login or show nothing
  if (!session?.user) {
    return (
      <div className="text-sm text-red">
        No session found
      </div>
    );
  }

  // Use profile data (from app_users) with fallback to session data
  const USER = {
    name: profile?.name || session.user.name || "User",
    email: profile?.email || session.user.email || "",
    img: getAvatarUrl(profile?.avatar || session.user.image),
  };

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="rounded align-middle outline-none ring-primary ring-offset-2 focus-visible:ring-1 dark:ring-offset-gray-dark">
        <span className="sr-only">My Account</span>

        <figure className="flex items-center gap-3">
          <Image
            src={USER.img}
            className="size-12 rounded-full object-cover"
            alt={`Avatar of ${USER.name}`}
            role="presentation"
            width={200}
            height={200}
            unoptimized={USER.img.startsWith('/api/')} // Skip optimization for proxied images
          />
          <figcaption className="flex items-center gap-1 font-medium text-dark dark:text-dark-6 max-[1024px]:sr-only">
            <span>{USER.name}</span>

            <ChevronUpIcon
              aria-hidden
              className={cn(
                "rotate-180 transition-transform",
                isOpen && "rotate-0",
              )}
              strokeWidth={1.5}
            />
          </figcaption>
        </figure>
      </DropdownTrigger>

      <DropdownContent
        className="border border-stroke bg-white shadow-md dark:border-dark-3 dark:bg-gray-dark min-[230px]:min-w-70"
        align="end"
      >
        <h2 className="sr-only">User information</h2>

        <figure className="flex items-center gap-2.5 px-5 py-3.5">
          <Image
            src={USER.img}
            className="size-12 rounded-full object-cover"
            alt={`Avatar for ${USER.name}`}
            role="presentation"
            width={200}
            height={200}
            unoptimized={USER.img.startsWith('/api/')} // Skip optimization for proxied images
          />

          <figcaption className="space-y-1 text-base font-medium">
            <div className="mb-2 leading-none text-dark dark:text-white">
              {USER.name}
            </div>

            <div className="leading-none text-gray-6">{USER.email}</div>
          </figcaption>
        </figure>

        <hr className="border-[#E8E8E8] dark:border-dark-3" />

        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6 *:cursor-pointer">
          <Link
            href={"/instructor/profile"}
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
          >
            <UserIcon />

            <span className="mr-auto text-base font-medium">View profile</span>
          </Link>

          <Link
            href={"/settings"}
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
          >
            <SettingsIcon />

            <span className="mr-auto text-base font-medium">
              Account Settings
            </span>
          </Link>
        </div>

        <hr className="border-[#E8E8E8] dark:border-dark-3" />

        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6">
          <button
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
            onClick={handleLogout}
          >
            <LogOutIcon />

            <span className="text-base font-medium">Log out</span>
          </button>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}