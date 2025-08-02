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
    <Card className="bg-bron-bg-tertiary border-bron-border hover:shadow-lg transition-shadow duration-300">
      <CardContent className="flex items-center p-4">
        <Icon className={`h-8 w-8 ${iconColor} mr-3`} />
        <div>
          <AnimatedCounter
            value={value}
            duration={2.5}
            delay={delay}
            className="text-2xl font-bold text-bron-text-primary"
          />
          <p className="text-sm text-bron-text-muted">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
