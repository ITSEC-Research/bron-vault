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
  return (
    <Card className="bg-bron-bg-tertiary border-bron-border hover:border-bron-text-muted/50 transition-colors group">
      <CardContent className="flex items-center p-4 gap-4">
        <div className="p-2 rounded-md bg-bron-bg-secondary group-hover:bg-opacity-80 transition-colors">
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div>
          <AnimatedCounter
            value={value}
            duration={2.5}
            delay={delay}
            className="text-2xl font-bold text-bron-text-primary"
          />
          <p className="text-xs text-bron-text-muted capitalize tracking-wider">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
