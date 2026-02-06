// lib/session-utils.js
import { authClient } from '@/lib/auth-client'

export async function getSession() {
  try {
    const { data: session } = await authClient.getSession()
    return session
  } catch (error) {
    console.error('Error fetching session:', error)
    return null
  }
}