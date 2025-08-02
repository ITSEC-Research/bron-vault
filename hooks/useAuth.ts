'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: number
  email: string
  name: string
}

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export function useAuth(requireAuth: boolean = true) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  })
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/get-user', {
          credentials: 'include'
        })

        // Check if response is a redirect (HTML response)
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Authentication failed - redirected to login')
        }

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setAuthState({
              user: data.user,
              loading: false,
              error: null
            })
          } else {
            throw new Error(data.error || 'Authentication failed')
          }
        } else {
          throw new Error('Authentication failed')
        }
      } catch (error) {
        setAuthState({
          user: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Authentication failed'
        })

        // Redirect to login if authentication is required
        if (requireAuth) {
          const currentPath = window.location.pathname
          router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`)
        }
      }
    }

    checkAuth()
  }, [requireAuth, router])

  return authState
}
