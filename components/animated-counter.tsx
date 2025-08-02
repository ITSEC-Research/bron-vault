"use client"

import { useEffect, useState } from "react"
import { motion, useInView } from "framer-motion"
import { useRef } from "react"

interface AnimatedCounterProps {
  value: number
  duration?: number
  delay?: number
  className?: string
}

export function AnimatedCounter({
  value,
  duration = 2,
  delay = 0,
  className = ""
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  // Safety check for value
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0

  useEffect(() => {
    if (!isInView) return

    let startTime: number
    let animationFrame: number
    let isCancelled = false

    const animate = (timestamp: number) => {
      if (isCancelled) return

      if (!startTime) startTime = timestamp + delay * 1000

      if (timestamp < startTime) {
        animationFrame = requestAnimationFrame(animate)
        return
      }

      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)

      if (!isCancelled) {
        setCount(Math.floor(easeOutQuart * safeValue))
      }

      if (progress < 1 && !isCancelled) {
        animationFrame = requestAnimationFrame(animate)
      } else if (!isCancelled) {
        setCount(safeValue)
      }
    }

    animationFrame = requestAnimationFrame(animate)

    return () => {
      isCancelled = true
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [safeValue, duration, delay, isInView])

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
      transition={{ 
        duration: 0.5, 
        delay: delay,
        type: "spring",
        stiffness: 100
      }}
    >
      {count.toLocaleString()}
    </motion.span>
  )
}
