"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"

interface SoftwareData {
  software_name: string
  version: string | null
  count: number
}

interface AnimatedSoftwareListProps {
  softwareData: SoftwareData[]
}

export function AnimatedSoftwareList({ softwareData }: AnimatedSoftwareListProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  // Safety check for softwareData
  const safeSoftwareData = Array.isArray(softwareData) ? softwareData : []

  if (safeSoftwareData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[450px]">
        <div className="text-center">
          <p className="text-muted-foreground">No software data available</p>
          <p className="text-xs text-muted-foreground mt-2">Upload some stealer logs to see software statistics</p>
        </div>
      </div>
    )
  }

  const maxCount = Math.max(...safeSoftwareData.map(s => s?.count || 0))

  return (
    <div ref={ref} className="space-y-2.5 h-full">
      {safeSoftwareData.map((item, index) => {
        const percentage = maxCount > 0 ? ((item?.count || 0) / maxCount) * 100 : 0

        return (
          <div
            key={`${item?.software_name || 'unknown'}-${item?.version || 'no-version'}-${index}`}
            className="space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <div 
                  className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 relative"
                  style={{
                    background: index < 3 
                      ? "linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(16, 185, 129, 0.15))"
                      : "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))",
                    border: `1.5px solid ${index < 3 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(16, 185, 129, 0.4)'}`,
                    color: index < 3 ? "rgb(16, 185, 129)" : "rgba(16, 185, 129, 0.9)"
                  }}
                >
                  #{index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-foreground truncate">
                      {item?.software_name || 'Unknown Software'}
                    </span>
                    {item?.version && (
                      <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded border border-white/5 flex-shrink-0">
                        {item.version}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-mono ml-2 flex-shrink-0">
                {Number(item?.count || 0).toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-secondary/30 rounded-full h-2.5 overflow-hidden border border-border/30">
              <motion.div
                className="h-full rounded-full relative"
                style={{
                  background: "linear-gradient(to right, rgba(30, 58, 138, 0.85), rgba(30, 58, 138, 0.65), rgba(30, 58, 138, 0.5))",
                  boxShadow: "0 0 12px rgba(30, 58, 138, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(30, 58, 138, 0.4)"
                }}
                initial={{ width: 0 }}
                animate={isInView ? { width: `${percentage}%` } : { width: 0 }}
                transition={{
                  duration: 1.2,
                  delay: index * 0.1 + 0.3,
                  type: "spring",
                  stiffness: 80
                }}
              >
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-full" />
              </motion.div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
