"use client"

import { AnimationDemo } from "@/components/animation-demo"

export default function AnimationDemoPage() {
  return (
    <div className="min-h-screen bg-bron-bg-primary p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-bron-text-primary mb-2">
            🎬 Dashboard Animation Demo
          </h1>
          <p className="text-bron-text-muted">
            Animation demonstration that has been added to the broń Vault dashboard
          </p>
        </div>
        
        <AnimationDemo />
      </div>
    </div>
  )
}
