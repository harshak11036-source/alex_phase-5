'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface ExtendedUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  avatarUrl?: string | null
  role?: string
  activeMembership?: {
    role: string
    institutionId: string
    departmentId: string | null
    courseId: string | null
    semesterId: string | null
  }
}

interface AuthContextType {
  user: ExtendedUser | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchUser(): Promise<ExtendedUser | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include', signal: controller.signal })
    if (!response.ok) return null
    const data = await response.json()
    return data.user
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const userData = await fetchUser()
      setUser(userData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'GET', credentials: 'include' })
    } catch {
      // Ignore errors
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
