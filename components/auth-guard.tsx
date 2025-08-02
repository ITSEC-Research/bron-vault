'use client'

import { useAuth } from '@/hooks/useAuth'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { user, loading, error } = useAuth(true)

  if (loading) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking authentication...</p>
          </div>
        </div>
      )
    )
  }

  if (error || !user) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-red-600 mb-4">Authentication required</p>
            <p className="text-gray-600">Redirecting to login...</p>
          </div>
        </div>
      )
    )
  }

  return <>{children}</>
}
