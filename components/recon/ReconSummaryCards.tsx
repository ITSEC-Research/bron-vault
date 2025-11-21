"use client"

import { Globe, Link, Key, Copy, HardDrive } from "lucide-react"
import { AnimatedStatCard } from "@/components/animated-stat-card"

interface SummaryStats {
  totalSubdomains: number
  totalPaths: number
  totalCredentials: number
  totalReusedCredentials: number
  totalDevices: number
}

interface ReconSummaryCardsProps {
  stats: SummaryStats
}

export function ReconSummaryCards({ stats }: ReconSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
      <AnimatedStatCard
        icon={Globe}
        value={stats.totalSubdomains}
        label="Subdomains"
        iconColor="text-bron-accent-blue"
        delay={0}
      />
      <AnimatedStatCard
        icon={Link}
        value={stats.totalPaths}
        label="Paths"
        iconColor="text-bron-accent-yellow"
        delay={0.2}
      />
      <AnimatedStatCard
        icon={Key}
        value={stats.totalCredentials}
        label="Credentials"
        iconColor="text-bron-accent-green"
        delay={0.4}
      />
      <AnimatedStatCard
        icon={Copy}
        value={stats.totalReusedCredentials}
        label="Reused Credentials"
        iconColor="text-bron-accent-red"
        delay={0.6}
      />
      <AnimatedStatCard
        icon={HardDrive}
        value={stats.totalDevices}
        label="Devices"
        iconColor="text-bron-accent-blue"
        delay={0.8}
      />
    </div>
  )
}

