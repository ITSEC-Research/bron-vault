// Accessibility utilities and hooks

import { useEffect, useRef, useState } from 'react'

// Focus management utilities
export function trapFocus(element: HTMLElement) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  
  const firstElement = focusableElements[0] as HTMLElement
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

  function handleTabKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus()
        e.preventDefault()
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus()
        e.preventDefault()
      }
    }
  }

  element.addEventListener('keydown', handleTabKey)
  
  // Focus first element
  firstElement?.focus()

  return () => {
    element.removeEventListener('keydown', handleTabKey)
  }
}

// Hook for managing focus trap
export function useFocusTrap(isActive: boolean) {
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isActive || !elementRef.current) return

    const cleanup = trapFocus(elementRef.current)
    return cleanup
  }, [isActive])

  return elementRef
}

// Hook for restoring focus
export function useFocusRestore() {
  const previousActiveElement = useRef<HTMLElement | null>(null)

  const saveFocus = () => {
    previousActiveElement.current = document.activeElement as HTMLElement
  }

  const restoreFocus = () => {
    if (previousActiveElement.current) {
      previousActiveElement.current.focus()
    }
  }

  return { saveFocus, restoreFocus }
}

// Keyboard navigation utilities
export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  TAB: 'Tab',
  HOME: 'Home',
  END: 'End'
} as const

// ARIA utilities
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}

export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.setAttribute('class', 'sr-only')
  announcement.textContent = message

  document.body.appendChild(announcement)

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

// Color contrast utilities
export function getContrastRatio(color1: string, color2: string): number {
  // Simplified contrast ratio calculation
  // In a real implementation, you'd want a more robust color parsing library
  const getLuminance = (color: string): number => {
    // This is a simplified version - you'd want proper color parsing
    const rgb = color.match(/\d+/g)
    if (!rgb) return 0
    
    const [r, g, b] = rgb.map(x => {
      const val = parseInt(x) / 255
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
    })
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)

  return (brightest + 0.05) / (darkest + 0.05)
}

export function meetsWCAGContrast(color1: string, color2: string, level: 'AA' | 'AAA' = 'AA'): boolean {
  const ratio = getContrastRatio(color1, color2)
  return level === 'AA' ? ratio >= 4.5 : ratio >= 7
}

// Screen reader utilities
export function hideFromScreenReader(element: HTMLElement) {
  element.setAttribute('aria-hidden', 'true')
}

export function showToScreenReader(element: HTMLElement) {
  element.removeAttribute('aria-hidden')
}

// Skip link utilities
export function createSkipLink(targetId: string, text: string = 'Skip to main content'): HTMLElement {
  const skipLink = document.createElement('a')
  skipLink.href = `#${targetId}`
  skipLink.textContent = text
  skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded'
  
  return skipLink
}

// Reduced motion utilities
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
    mediaQuery.addEventListener('change', handler)

    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReduced
}

// Form accessibility utilities
export function getFormErrorId(fieldName: string): string {
  return `${fieldName}-error`
}

export function getFormDescriptionId(fieldName: string): string {
  return `${fieldName}-description`
}

export function createFormFieldProps(fieldName: string, hasError: boolean = false) {
  const errorId = getFormErrorId(fieldName)
  const descriptionId = getFormDescriptionId(fieldName)

  return {
    'aria-invalid': hasError,
    'aria-describedby': hasError ? errorId : descriptionId
  }
}
