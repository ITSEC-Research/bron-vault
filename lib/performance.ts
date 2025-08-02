"use client"

import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals'
import { logInfo, logWarn } from './logger'

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 },   // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
  
  // Other metrics
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 800, poor: 1800 }  // Time to First Byte
}

interface PerformanceData {
  metric: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
  url: string
  userAgent: string
}

class PerformanceMonitor {
  private metrics: PerformanceData[] = []
  private isEnabled: boolean = true

  constructor() {
    // Disable in development to avoid noise
    this.isEnabled = process.env.NODE_ENV === 'production'
    
    if (this.isEnabled && typeof window !== 'undefined') {
      this.initializeWebVitals()
      this.initializeCustomMetrics()
    }
  }

  private initializeWebVitals() {
    // Core Web Vitals
    getCLS(this.handleMetric.bind(this))
    getFID(this.handleMetric.bind(this))
    getLCP(this.handleMetric.bind(this))
    
    // Additional metrics
    getFCP(this.handleMetric.bind(this))
    getTTFB(this.handleMetric.bind(this))
  }

  private handleMetric(metric: Metric) {
    const performanceData: PerformanceData = {
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    }

    this.metrics.push(performanceData)
    this.logMetric(performanceData)
    this.sendToAnalytics(performanceData)
  }

  private logMetric(data: PerformanceData) {
    const message = `${data.metric}: ${data.value.toFixed(2)}ms (${data.rating})`
    
    if (data.rating === 'poor') {
      logWarn(message, data, 'Performance')
    } else {
      logInfo(message, data, 'Performance')
    }
  }

  private async sendToAnalytics(data: PerformanceData) {
    // In a real application, you'd send this to your analytics service
    // For now, we'll just store it locally or send to a custom endpoint
    
    try {
      // Example: Send to custom analytics endpoint
      if (this.shouldSendMetric(data)) {
        await fetch('/api/analytics/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
      }
    } catch (error) {
      // Silently fail - don't let analytics break the app
      console.debug('Failed to send performance metric:', error)
    }
  }

  private shouldSendMetric(data: PerformanceData): boolean {
    // Only send poor metrics or sample good ones
    return data.rating === 'poor' || Math.random() < 0.1
  }

  private initializeCustomMetrics() {
    // Monitor page load time
    window.addEventListener('load', () => {
      const loadTime = performance.now()
      this.recordCustomMetric('page-load', loadTime)
    })

    // Monitor route changes (for SPA)
    this.monitorRouteChanges()
    
    // Monitor resource loading
    this.monitorResourceLoading()
  }

  private monitorRouteChanges() {
    let lastUrl = window.location.href
    
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href
      if (currentUrl !== lastUrl) {
        const navigationTime = performance.now()
        this.recordCustomMetric('route-change', navigationTime)
        lastUrl = currentUrl
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  }

  private monitorResourceLoading() {
    // Monitor slow loading resources
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 1000) { // Resources taking more than 1s
          this.recordCustomMetric('slow-resource', entry.duration, {
            name: entry.name,
            type: (entry as any).initiatorType
          })
        }
      })
    })

    observer.observe({ entryTypes: ['resource'] })
  }

  public recordCustomMetric(name: string, value: number, metadata?: any) {
    const data: PerformanceData = {
      metric: name,
      value,
      rating: this.getRating(name, value),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    }

    this.metrics.push(data)
    this.logMetric(data)
    
    if (metadata) {
      logInfo(`${name} metadata`, metadata, 'Performance')
    }
  }

  private getRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = PERFORMANCE_THRESHOLDS[metric as keyof typeof PERFORMANCE_THRESHOLDS]
    
    if (!threshold) return 'good' // Unknown metrics default to good
    
    if (value <= threshold.good) return 'good'
    if (value <= threshold.poor) return 'needs-improvement'
    return 'poor'
  }

  public getMetrics(): PerformanceData[] {
    return [...this.metrics]
  }

  public getMetricsSummary() {
    const summary = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.metric]) {
        acc[metric.metric] = {
          count: 0,
          total: 0,
          good: 0,
          needsImprovement: 0,
          poor: 0
        }
      }

      const metricSummary = acc[metric.metric]
      metricSummary.count++
      metricSummary.total += metric.value

      switch (metric.rating) {
        case 'good':
          metricSummary.good++
          break
        case 'needs-improvement':
          metricSummary.needsImprovement++
          break
        case 'poor':
          metricSummary.poor++
          break
      }

      return acc
    }, {} as Record<string, any>)

    // Calculate averages
    Object.values(summary).forEach((metricSummary: any) => {
      metricSummary.average = metricSummary.total / metricSummary.count
    })

    return summary
  }

  public clearMetrics() {
    this.metrics = []
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Utility functions
export function measureAsyncOperation<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = performance.now()
  
  return operation().finally(() => {
    const duration = performance.now() - start
    performanceMonitor.recordCustomMetric(`async-${name}`, duration)
  })
}

export function measureSyncOperation<T>(
  name: string,
  operation: () => T
): T {
  const start = performance.now()
  const result = operation()
  const duration = performance.now() - start
  
  performanceMonitor.recordCustomMetric(`sync-${name}`, duration)
  return result
}

// React hook for performance monitoring
export function usePerformanceMonitor() {
  return {
    recordMetric: performanceMonitor.recordCustomMetric.bind(performanceMonitor),
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
    getSummary: performanceMonitor.getMetricsSummary.bind(performanceMonitor),
    measureAsync: measureAsyncOperation,
    measureSync: measureSyncOperation
  }
}
