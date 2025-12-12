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
    <Card className="glass-card hover:border-primary/30 transition-all duration-500 group">
      <CardContent className="flex items-center p-4 gap-4">
        <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300 ring-1 ring-inset ring-primary/20">
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div>
          <AnimatedCounter
            value={value}
            duration={2.5}
            delay={delay}
            className="text-2xl font-bold text-foreground"
          />
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
