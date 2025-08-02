"use client"

import React, { useState, useEffect } from "react"

interface TypingEffectProps {
  sentences: string[]
  isVisible: boolean
  typingSpeed?: number
  pauseDuration?: number
}

export function TypingEffect({ 
  sentences, 
  isVisible, 
  typingSpeed = 28, 
  pauseDuration = 3000 
}: TypingEffectProps) {
  const [typingText, setTypingText] = useState("")
  const [typingIndex, setTypingIndex] = useState(0)

  useEffect(() => {
    if (!isVisible || sentences.length === 0) return

    setTypingText("")
    let i = 0
    let cancelled = false
    const fullText = sentences[typingIndex]

    function type() {
      if (cancelled) return
      if (i < fullText.length) {
        setTypingText(fullText.slice(0, i + 1))
        i++
        setTimeout(type, typingSpeed)
      } else {
        // Wait before switching to the next sentence
        setTimeout(() => {
          setTypingIndex((prev) => (prev + 1) % sentences.length)
        }, pauseDuration)
      }
    }

    type()
    return () => {
      cancelled = true
    }
  }, [isVisible, typingIndex, sentences, typingSpeed, pauseDuration])

  if (!isVisible || sentences.length === 0) {
    return null
  }

  return (
    <div className="w-full flex flex-col items-center mb-4 mt-8">
      <span className="font-mono text-bron-text-muted text-2xl font-bold mb-2 h-8 min-h-[2rem]">
        {typeof typingText === "string" ? typingText.replace(/undefined/g, "") : ""}
        {typingText.length > 0 && typingText.length < sentences[typingIndex].length ? (
          <span className="inline-block w-2 animate-pulse align-bottom">|</span>
        ) : null}
      </span>
    </div>
  )
}
