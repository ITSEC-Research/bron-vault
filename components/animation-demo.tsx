"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AnimatedStatCard } from "./animated-stat-card"
import { AnimatedSoftwareList } from "./animated-software-list"
import BrowserVerticalBarChart from "./browser-vertical-bar-chart"
import { HardDrive, Key, Database, Globe, Link, Monitor, Package, Play, RotateCcw } from "lucide-react"

// Demo data
const demoStats = {
  totalDevices: 58,
  totalCredentials: 10027,
  totalFiles: 1242,
  totalDomains: 9769,
  totalUrls: 10023
}

const demoBrowserData = [
  { browser: "Microsoft Edge", count: 13 },
  { browser: "Google Chrome", count: 10 },
  { browser: "Unknown", count: 2 },
  { browser: "Opera", count: 1 },
  { browser: "Brave", count: 1 },
  { browser: "Mozilla Firefox", count: 1 }
]

const demoSoftwareData = [
  { software_name: "Microsoft Edge", version: null, count: 8 },
  { software_name: "Microsoft Edge WebView2 Runtime", version: null, count: 8 },
  { software_name: "Microsoft Update Health Tools", version: null, count: 5 },
  { software_name: "Microsoft Visual C++ 2013 x64 Additional Runtime", version: "12.0.40664", count: 5 },
  { software_name: "Microsoft Visual C++ 2013 x64 Minimum Runtime", version: "12.0.40664", count: 5 },
  { software_name: "Google Chrome", version: null, count: 4 },
  { software_name: "Intel(R) Processor Graphics", version: null, count: 4 }
]

export function AnimationDemo() {
  const [showDemo, setShowDemo] = useState(false)
  const [key, setKey] = useState(0)

  const startDemo = () => {
    setShowDemo(true)
    setKey(prev => prev + 1)
  }

  const resetDemo = () => {
    setShowDemo(false)
    setKey(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-foreground">
            <span>🎬 Animation Demo</span>
            <div className="flex gap-2">
              <Button onClick={startDemo} size="sm" className="bg-primary hover:bg-primary/90">
                <Play className="h-4 w-4 mr-2" />
                Start Demo
              </Button>
              <Button onClick={resetDemo} size="sm" variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Click "Start Demo" to see all animations in action with sample data.
          </p>
          
          {showDemo && (
            <motion.div
              key={key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Animated Statistics */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  📊 Animated Statistics (Count from 0 to target)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <AnimatedStatCard
                    icon={HardDrive}
                    value={demoStats.totalDevices}
                    label="Total Devices"
                    iconColor="text-blue-500"
                    delay={0}
                  />
                  <AnimatedStatCard
                    icon={Key}
                    value={demoStats.totalCredentials}
                    label="Total Credentials"
                    iconColor="text-emerald-500"
                    delay={0.2}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <AnimatedStatCard
                    icon={Database}
                    value={demoStats.totalFiles}
                    label="Files Extracted"
                    iconColor="text-emerald-500"
                    delay={0.4}
                  />
                  <AnimatedStatCard
                    icon={Globe}
                    value={demoStats.totalDomains}
                    label="Total Domains"
                    iconColor="text-blue-500"
                    delay={0.6}
                  />
                  <AnimatedStatCard
                    icon={Link}
                    value={demoStats.totalUrls}
                    label="Total URLs"
                    iconColor="text-amber-500"
                    delay={0.8}
                  />
                </div>
              </div>

              {/* Animated Browser Chart */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  📈 Animated Browser Chart (Bars grow from bottom to top)
                </h3>
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center text-foreground">
                      <Monitor className="h-5 w-5 mr-2 text-violet-500" />
                      Top Browsers Used by Infected Devices
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full h-[375px] flex items-end justify-center mt-10">
                      <BrowserVerticalBarChart browserData={demoBrowserData} height={350} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Animated Software List */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  📋 Animated Software List (Slide in from left)
                </h3>
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center text-foreground">
                      <Package className="h-5 w-5 mr-2 text-emerald-500" />
                      Most Common Software Found in Logs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AnimatedSoftwareList softwareData={demoSoftwareData} />
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
