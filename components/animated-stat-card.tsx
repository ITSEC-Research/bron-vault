"use client"

import { Card, CardContent } from "@/components/ui/card"
import { AnimatedCounter } from "./animated-counter"
import { LucideIcon } from "lucide-react"

interface AnimatedStatCardProps {
  icon: LucideIcon
  value: number
  label: string
  iconColor: string
  delay?: number
}

export function AnimatedStatCard({
  icon: Icon,
  value,
  label,
  iconColor,
  delay = 0
}: AnimatedStatCardProps) {
  // Extract color from iconColor class for gradient
  const getColorValues = (colorClass: string) => {
    if (colorClass.includes('blue')) return { from: 'rgba(59, 130, 246, 0.2)', to: 'rgba(59, 130, 246, 0.05)', glow: 'rgba(59, 130, 246, 0.25)' }
    if (colorClass.includes('emerald')) return { from: 'rgba(16, 185, 129, 0.2)', to: 'rgba(16, 185, 129, 0.05)', glow: 'rgba(16, 185, 129, 0.25)' }
    if (colorClass.includes('amber')) return { from: 'rgba(245, 158, 11, 0.2)', to: 'rgba(245, 158, 11, 0.05)', glow: 'rgba(245, 158, 11, 0.25)' }
    if (colorClass.includes('cyan')) return { from: 'rgba(6, 182, 212, 0.2)', to: 'rgba(6, 182, 212, 0.05)', glow: 'rgba(6, 182, 212, 0.25)' }
    if (colorClass.includes('violet')) return { from: 'rgba(139, 92, 246, 0.2)', to: 'rgba(139, 92, 246, 0.05)', glow: 'rgba(139, 92, 246, 0.25)' }
    return { from: 'rgba(255, 51, 51, 0.2)', to: 'rgba(255, 51, 51, 0.05)', glow: 'rgba(255, 51, 51, 0.25)' }
  }

  const colors = getColorValues(iconColor)

  return (
    <Card className="glass-card hover:border-primary/30 transition-all duration-500 group">
      <CardContent className="flex items-center p-3 gap-3">
        <div 
          className="p-2.5 rounded-xl relative group-hover:scale-110 transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
            border: `1.5px solid ${colors.from.replace('0.2', '0.3')}`,
            boxShadow: `0 0 8px ${colors.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`
          }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Icon className={`w-5 h-5 ${iconColor} relative z-10 drop-shadow-sm`} />
        </div>
        <div>
          <AnimatedCounter
            value={value}
            duration={2.5}
            delay={delay}
            className="text-xl font-bold text-foreground"
          />
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-0.5">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
