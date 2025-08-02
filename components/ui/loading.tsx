"use client"

import { cn } from "@/lib/utils"
import { Loader2, Database, Search, Upload, BarChart3 } from "lucide-react"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  }

  return (
    <Loader2 
      className={cn("animate-spin", sizeClasses[size], className)} 
      aria-label="Loading"
    />
  )
}

interface LoadingStateProps {
  type?: "search" | "upload" | "stats" | "chart" | "data" | "default"
  message?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingState({ 
  type = "default", 
  message, 
  size = "md", 
  className 
}: LoadingStateProps) {
  const icons = {
    search: Search,
    upload: Upload,
    stats: BarChart3,
    chart: BarChart3,
    data: Database,
    default: Loader2
  }

  const messages = {
    search: "Searching database...",
    upload: "Processing upload...",
    stats: "Loading statistics...",
    chart: "Generating chart...",
    data: "Loading data...",
    default: "Loading..."
  }

  const Icon = icons[type]
  const defaultMessage = messages[type]

  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 text-center",
      className
    )}>
      <Icon 
        className={cn(
          "animate-spin text-bron-accent-blue mb-3",
          size === "sm" && "h-6 w-6",
          size === "md" && "h-8 w-8",
          size === "lg" && "h-12 w-12"
        )}
        aria-label="Loading"
      />
      <p className={cn(
        "text-bron-text-muted",
        size === "sm" && "text-sm",
        size === "md" && "text-base",
        size === "lg" && "text-lg"
      )}>
        {message || defaultMessage}
      </p>
    </div>
  )
}

interface LoadingCardProps {
  title?: string
  description?: string
  className?: string
}

export function LoadingCard({ title, description, className }: LoadingCardProps) {
  return (
    <div className={cn(
      "bg-bron-bg-tertiary border border-bron-border rounded-lg p-6",
      className
    )}>
      <div className="animate-pulse">
        {title && (
          <div className="h-6 bg-bron-bg-secondary rounded mb-4 w-3/4"></div>
        )}
        <div className="space-y-3">
          <div className="h-4 bg-bron-bg-secondary rounded w-full"></div>
          <div className="h-4 bg-bron-bg-secondary rounded w-5/6"></div>
          <div className="h-4 bg-bron-bg-secondary rounded w-4/6"></div>
        </div>
        {description && (
          <div className="h-3 bg-bron-bg-secondary rounded mt-4 w-2/3"></div>
        )}
      </div>
    </div>
  )
}

interface LoadingTableProps {
  rows?: number
  columns?: number
  className?: string
}

export function LoadingTable({ rows = 5, columns = 4, className }: LoadingTableProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="grid gap-4 animate-pulse" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-bron-bg-secondary rounded"></div>
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex} 
          className="grid gap-4 animate-pulse" 
          style={{ 
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            animationDelay: `${rowIndex * 100}ms`
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div 
              key={colIndex} 
              className="h-3 bg-bron-bg-secondary rounded"
              style={{ width: `${Math.random() * 40 + 60}%` }}
            ></div>
          ))}
        </div>
      ))}
    </div>
  )
}

interface LoadingChartProps {
  height?: number
  className?: string
}

export function LoadingChart({ height = 300, className }: LoadingChartProps) {
  return (
    <div 
      className={cn("bg-bron-bg-tertiary border border-bron-border rounded-lg p-4", className)}
      style={{ height }}
    >
      <div className="animate-pulse h-full flex flex-col">
        {/* Chart title */}
        <div className="h-4 bg-bron-bg-secondary rounded w-1/3 mb-4"></div>
        
        {/* Chart area */}
        <div className="flex-1 flex items-end justify-between space-x-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div 
              key={i}
              className="bg-bron-bg-secondary rounded-t"
              style={{ 
                height: `${Math.random() * 80 + 20}%`,
                width: '12%'
              }}
            ></div>
          ))}
        </div>
        
        {/* X-axis labels */}
        <div className="flex justify-between mt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-2 bg-bron-bg-secondary rounded w-8"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface LoadingButtonProps {
  children: React.ReactNode
  loading?: boolean
  disabled?: boolean
  className?: string
  onClick?: () => void
}

export function LoadingButton({ 
  children, 
  loading = false, 
  disabled = false, 
  className,
  onClick 
}: LoadingButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center px-4 py-2 rounded-md",
        "bg-bron-accent-blue text-white font-medium",
        "hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors duration-200",
        className
      )}
    >
      {loading && <LoadingSpinner size="sm" className="mr-2" />}
      {children}
    </button>
  )
}
