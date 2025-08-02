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
      <div className="text-center py-8">
        <p className="text-bron-text-muted">No software data available</p>
        <p className="text-xs text-bron-text-muted mt-2">Upload some stealer logs to see software statistics</p>
      </div>
    )
  }

  const maxCount = Math.max(...safeSoftwareData.map(s => s?.count || 0))

  return (
    <div ref={ref} className="space-y-3">
      {safeSoftwareData.map((item, index) => {
        const percentage = maxCount > 0 ? ((item?.count || 0) / maxCount) * 100 : 0

        return (
          <div
            key={`${item?.software_name || 'unknown'}-${item?.version || 'no-version'}-${index}`}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-bron-accent-green text-white text-xs font-bold flex-shrink-0">
                  #{index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-bron-text-primary truncate">
                      {item?.software_name || 'Unknown Software'}
                    </span>
                    {item?.version && (
                      <span className="text-xs text-bron-text-muted bg-bron-bg-secondary px-2 py-1 rounded border border-bron-border flex-shrink-0">
                        {item.version}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-bron-text-muted font-mono ml-2 flex-shrink-0">
                {item?.count || 0}
              </span>
            </div>
            <div className="w-full bg-bron-bg-secondary rounded-full h-2 border border-bron-border overflow-hidden">
              <motion.div
                className="bg-red-800 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={isInView ? { width: `${percentage}%` } : { width: 0 }}
                transition={{
                  duration: 1.2,
                  delay: index * 0.1 + 0.3,
                  type: "spring",
                  stiffness: 80
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
