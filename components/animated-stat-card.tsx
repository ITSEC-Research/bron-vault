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
      <CardContent className="flex items-center p-3 gap-3">
        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300 ring-1 ring-inset ring-primary/20">
          <Icon className={`w-5 h-5 ${iconColor}`} />
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
