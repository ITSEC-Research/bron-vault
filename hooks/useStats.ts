import { useState, useEffect, useCallback, useRef } from "react"

interface Stats {
  totalDevices: number
  uniqueDeviceNames: number
  duplicateDeviceNames: number
  totalFiles: number
  totalCredentials: number
  totalDomains: number
  totalUrls: number
}

interface TopPassword {
  password: string
  total_count: number
}

interface UseStatsReturn {
  stats: Stats
  topPasswords: TopPassword[]
  isStatsLoaded: boolean
  statsError: string | null
  loadStats: () => Promise<void>
}

export function useStats(): UseStatsReturn {
  const [stats, setStats] = useState<Stats>({
    totalDevices: 0,
    uniqueDeviceNames: 0,
    duplicateDeviceNames: 0,
    totalFiles: 0,
    totalCredentials: 0,
    totalDomains: 0,
    totalUrls: 0,
  })
  const [topPasswords, setTopPasswords] = useState<TopPassword[]>([])
  const [isStatsLoaded, setIsStatsLoaded] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Add caching and prevent multiple simultaneous requests
  const cacheRef = useRef<{ data: any; timestamp: number } | null>(null)
  const loadingRef = useRef(false)
  const CACHE_DURATION = 30000 // 30 seconds

  const loadStats = useCallback(async () => {
    // Check cache first
    if (cacheRef.current) {
      const { data, timestamp } = cacheRef.current
      if (Date.now() - timestamp < CACHE_DURATION) {
        if (data.stats) {
          setStats(data.stats)
          setTopPasswords(data.topPasswords || [])
        } else {
          setStats(data)
        }
        setIsStatsLoaded(true)
        setStatsError(null)
        return
      }
    }

    // Prevent multiple simultaneous requests
    if (loadingRef.current) return
    loadingRef.current = true

    try {
      const response = await fetch("/api/stats")
      if (response.ok) {
        const data = await response.json()

        // Cache the response
        cacheRef.current = { data, timestamp: Date.now() }

        if (data.stats) {
          setStats(data.stats)
          setTopPasswords(data.topPasswords || [])
        } else {
          setStats(data)
        }
        setIsStatsLoaded(true)
        setStatsError(null)
      } else {
        setIsStatsLoaded(true)
        setStatsError("No data found. Please upload a .zip file first using the Upload menu to populate the search database.")
        setStats({
          totalDevices: 0,
          uniqueDeviceNames: 0,
          duplicateDeviceNames: 0,
          totalFiles: 0,
          totalCredentials: 0,
          totalDomains: 0,
          totalUrls: 0,
        })
      }
    } catch (_error) {
      setIsStatsLoaded(true)
      setStatsError("No data found. Please upload a .zip file first using the Upload menu to populate the search database.")
      setStats({
        totalDevices: 0,
        uniqueDeviceNames: 0,
        duplicateDeviceNames: 0,
        totalFiles: 0,
        totalCredentials: 0,
        totalDomains: 0,
        totalUrls: 0,
      })
    } finally {
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [])

  return {
    stats,
    topPasswords,
    isStatsLoaded,
    statsError,
    loadStats,
  }
}
