import { NextRequest, NextResponse } from 'next/server'
import { logInfo, logWarn } from '@/lib/logger'
import { validateRequest } from '@/lib/auth'

interface PerformanceMetric {
  metric: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
  url: string
  userAgent: string
}

// In-memory storage for demo purposes
// In production, you'd want to use a proper database or analytics service
const performanceMetrics: PerformanceMetric[] = []

export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const metric: PerformanceMetric = await request.json()
    
    // Validate the metric data
    if (!metric.metric || typeof metric.value !== 'number') {
      return NextResponse.json(
        { error: 'Invalid metric data' },
        { status: 400 }
      )
    }

    // Store the metric
    performanceMetrics.push(metric)
    
    // Log poor performance metrics
    if (metric.rating === 'poor') {
      logWarn(
        `Poor performance detected: ${metric.metric} = ${metric.value}ms`,
        metric,
        'Performance Analytics'
      )
    } else {
      logInfo(
        `Performance metric recorded: ${metric.metric} = ${metric.value}ms`,
        undefined,
        'Performance Analytics'
      )
    }

    // Keep only last 1000 metrics to prevent memory issues
    if (performanceMetrics.length > 1000) {
      performanceMetrics.splice(0, performanceMetrics.length - 1000)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logWarn('Failed to process performance metric', error, 'Performance Analytics')
    return NextResponse.json(
      { error: 'Failed to process metric' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const metric = searchParams.get('metric')
    const limit = parseInt(searchParams.get('limit') || '100')

    let filteredMetrics = performanceMetrics

    // Filter by metric type if specified
    if (metric) {
      filteredMetrics = performanceMetrics.filter(m => m.metric === metric)
    }

    // Limit results
    const results = filteredMetrics
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp)

    // Calculate summary statistics
    const summary = calculateSummary(filteredMetrics)

    return NextResponse.json({
      metrics: results,
      summary,
      total: filteredMetrics.length
    })
  } catch (error) {
    logWarn('Failed to retrieve performance metrics', error, 'Performance Analytics')
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    )
  }
}

function calculateSummary(metrics: PerformanceMetric[]) {
  if (metrics.length === 0) {
    return {
      count: 0,
      averageValue: 0,
      ratings: { good: 0, needsImprovement: 0, poor: 0 }
    }
  }

  const totalValue = metrics.reduce((sum, m) => sum + m.value, 0)
  const averageValue = totalValue / metrics.length

  const ratings = metrics.reduce(
    (acc, m) => {
      acc[m.rating === 'needs-improvement' ? 'needsImprovement' : m.rating]++
      return acc
    },
    { good: 0, needsImprovement: 0, poor: 0 }
  )

  return {
    count: metrics.length,
    averageValue: Math.round(averageValue * 100) / 100,
    ratings
  }
}
