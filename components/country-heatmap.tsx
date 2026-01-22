"use client"

import { useState, useEffect, useMemo } from "react"
import { ComposableMap, Geographies, Geography, ZoomableGroup, Graticule } from "react-simple-maps"
import { Globe, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"

// Map color constants - aligned with existing theme
const MAP_COLORS = {
  defaultFill: "#450a0a",              // Match lowest density (Deep Red, not Black-Red)
  defaultStroke: "hsl(0 0% 50%)",       // Brighter border (Gray-300 equivalent) for better definition
  hoverFill: "#facc15",                 // blue-500
  // "Magma V2" - Brighter Base for visibility
  // Deep Red -> Rich Red -> Neon (No longer "Near Black" at bottom)
  heatScale: [
    "#450a0a",    // Lowest (Deep Red - Visible)
    "#7f1d1d",    // Low (Dark Ruby)
    "#b91c1c",    // Medium (Firebrick)
    "#ef4444",    // High (Bright Red)
    "#f87171",    // Highest (Neon Red-Orange)
  ],
}

// TopoJSON URL - using world-110m which supports ISO codes
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

// Helper function to convert ISO Alpha-2 country code to flag emoji
const getCountryFlagEmoji = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return "🏳️"
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

// Helper object for mapping ISO numeric codes (from topojson) to Alpha-2
// This allows direct lookup in statsByAlpha2 (source of truth)
const isoNumericToAlpha2: Record<string, string> = {
  "004": "AF", "008": "AL", "010": "AQ", "012": "DZ", "016": "AS", "020": "AD", "024": "AO", "028": "AG", "031": "AZ", "032": "AR",
  "036": "AU", "040": "AT", "044": "BS", "048": "BH", "050": "BD", "051": "AM", "052": "BB", "056": "BE", "060": "BM", "064": "BT",
  "068": "BO", "070": "BA", "072": "BW", "074": "BV", "076": "BR", "084": "BZ", "086": "IO", "090": "SB", "092": "VG", "096": "BN",
  "100": "BG", "104": "MM", "108": "BI", "112": "BY", "116": "KH", "120": "CM", "124": "CA", "132": "CV", "136": "KY", "140": "CF",
  "144": "LK", "148": "TD", "152": "CL", "156": "CN", "158": "TW", "162": "CX", "166": "CC", "170": "CO", "174": "KM", "175": "YT",
  "178": "CG", "180": "CD", "184": "CK", "188": "CR", "191": "HR", "192": "CU", "196": "CY", "203": "CZ", "204": "BJ", "208": "DK",
  "212": "DM", "214": "DO", "218": "EC", "222": "SV", "226": "GQ", "231": "ET", "232": "ER", "233": "EE", "234": "FO", "238": "FK",
  "239": "GS", "242": "FJ", "246": "FI", "248": "AX", "250": "FR", "254": "GF", "258": "PF", "260": "TF", "262": "DJ", "266": "GA",
  "268": "GE", "270": "GM", "275": "PS", "276": "DE", "288": "GH", "292": "GI", "296": "KI", "300": "GR", "304": "GL", "308": "GD",
  "312": "GP", "316": "GU", "320": "GT", "324": "GN", "328": "GY", "332": "HT", "334": "HM", "336": "VA", "340": "HN", "344": "HK",
  "348": "HU", "352": "IS", "356": "IN", "360": "ID", "364": "IR", "368": "IQ", "372": "IE", "376": "IL", "380": "IT", "384": "CI",
  "388": "JM", "392": "JP", "398": "KZ", "400": "JO", "404": "KE", "408": "KP", "410": "KR", "414": "KW", "417": "KG", "418": "LA",
  "422": "LB", "426": "LS", "428": "LV", "430": "LR", "434": "LY", "438": "LI", "440": "LT", "442": "LU", "446": "MO", "450": "MG",
  "454": "MW", "458": "MY", "462": "MV", "466": "ML", "470": "MT", "474": "MQ", "478": "MR", "480": "MU", "484": "MX", "492": "MC",
  "496": "MN", "498": "MD", "499": "ME", "500": "MS", "504": "MA", "508": "MZ", "512": "OM", "516": "NA", "520": "NR", "524": "NP",
  "528": "NL", "530": "AN", "533": "AW", "540": "NC", "548": "VU", "554": "NZ", "558": "NI", "562": "NE", "566": "NG", "570": "NU",
  "574": "NF", "578": "NO", "580": "MP", "581": "UM", "583": "FM", "584": "MH", "585": "PW", "586": "PK", "591": "PA", "598": "PG",
  "600": "PY", "604": "PE", "608": "PH", "612": "PN", "616": "PL", "620": "PT", "624": "GW", "626": "TL", "630": "PR", "634": "QA",
  "638": "RE", "642": "RO", "643": "RU", "646": "RW", "652": "BL", "654": "SH", "659": "KN", "660": "AI", "662": "LC", "663": "MF",
  "666": "PM", "670": "VC", "674": "SM", "678": "ST", "682": "SA", "686": "SN", "688": "RS", "690": "SC", "694": "SL", "702": "SG",
  "703": "SK", "704": "VN", "705": "SI", "706": "SO", "710": "ZA", "716": "ZW", "724": "ES", "728": "SS", "729": "SD", "732": "EH",
  "740": "SR", "744": "SJ", "748": "SZ", "752": "SE", "756": "CH", "760": "SY", "762": "TJ", "764": "TH", "768": "TG", "772": "TK",
  "776": "TO", "780": "TT", "784": "AE", "788": "TN", "792": "TR", "795": "TM", "796": "TC", "798": "TV", "800": "UG", "804": "UA",
  "807": "MK", "818": "EG", "826": "GB", "834": "TZ", "840": "US", "850": "VI", "854": "BF", "858": "UY", "860": "UZ", "862": "VE",
  "876": "WF", "882": "WS", "887": "YE", "894": "ZM"
}


interface CountryStat {
  country: string          // Alpha-2 code
  countryName: string
  totalDevices: number
  totalCredentials: number
}

interface CountryStatsData {
  success: boolean
  countryStats: CountryStat[]
  summary: {
    totalDevices: number
    totalCredentials: number
    affectedCountries: number
  }
  topCountries: Array<CountryStat & { rank: number }>
  alpha2ToAlpha3Map: Record<string, string>
}

interface TooltipData {
  countryName: string
  totalDevices: number
  totalCredentials: number
  x: number
  y: number
}

interface CountryHeatmapProps {
  className?: string
  dateRange?: { startDate?: string; endDate?: string } | null
}

export function CountryHeatmap({ className, dateRange }: CountryHeatmapProps) {
  const [data, setData] = useState<CountryStatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<{
    left?: number
    right?: number
    top?: number
    bottom?: number
    transform: string
  }>({ transform: "translate(-50%, -100%)" })
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({ coordinates: [0, 0], zoom: 1.5 }) // Default zoom 1.5x

  // Fetch country stats
  useEffect(() => {
    const fetchCountryStats = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (dateRange?.startDate) params.set("startDate", dateRange.startDate)
        if (dateRange?.endDate) params.set("endDate", dateRange.endDate)
        const queryString = params.toString()
        const url = `/api/country-stats${queryString ? `?${queryString}` : ""}`
        
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error("Failed to fetch country statistics")
        }
        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error("Error fetching country stats:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setIsLoading(false)
      }
    }

    fetchCountryStats()
  }, [dateRange])

  // Create lookup maps for fast access
  const statsByAlpha3 = useMemo(() => {
    if (!data) return {}

    const map: Record<string, CountryStat> = {}
    for (const stat of data.countryStats) {
      const alpha3 = data.alpha2ToAlpha3Map[stat.country]
      if (alpha3) {
        map[alpha3] = stat
      }
    }
    return map
  }, [data])

  const statsByAlpha2 = useMemo(() => {
    if (!data) return {}

    const map: Record<string, CountryStat> = {}
    for (const stat of data.countryStats) {
      map[stat.country] = stat
    }
    return map
  }, [data])

  // Calculate max devices for color scale (percentage base)
  const maxDevices = useMemo(() => {
    if (!data || data.countryStats.length === 0) return 1
    return Math.max(...data.countryStats.map(s => s.totalDevices), 1)
  }, [data])

  // Get color for country based on percentage of max devices
  // Logarithmic Scale: 0% = default, then distributed by log10 values
  const getCountryColor = (deviceCount: number): string => {
    // User Request: 0 devices should ALWAYS be Density Level 1
    if (deviceCount === 0) return MAP_COLORS.heatScale[0]

    // Logarithmic Scale Implementation
    // Formula: (log10(value) / log10(max)) * 100
    // Visualises wide ranges (e.g. 50 vs 5000) better than linear

    // Ensure we don't do log(0) or divide by zero
    // Since deviceCount > 0 here, lowest log10(1) = 0.
    // If we have very small numbers > 0, they map properly.

    const logValue = Math.log10(deviceCount)
    const logMax = Math.log10(maxDevices)

    // Safety for single data point or max=1
    const percentage = logMax <= 0 ? 100 : (logValue / logMax) * 100

    if (percentage <= 20) return MAP_COLORS.heatScale[0]
    if (percentage <= 40) return MAP_COLORS.heatScale[1]
    if (percentage <= 60) return MAP_COLORS.heatScale[2]
    if (percentage <= 80) return MAP_COLORS.heatScale[3]
    return MAP_COLORS.heatScale[4]
  }

  // Handle geography click (for future: could filter/search)
  const handleGeographyClick = (geo: { properties: { NAME?: string } }) => {
    // Future: could implement country filter/search
    console.log("Clicked:", geo.properties.NAME)
  }

  // Handle geography mouse enter
  const handleGeographyMouseEnter = (
    geo: {
      properties: {
        NAME?: string
        name?: string
        ISO_A3?: string
        ISO3?: string
        iso_a3?: string
        ISO_A2?: string
        ISO2?: string
        iso_a2?: string
        [key: string]: any
      }
      id?: string | number
    },
    event: React.MouseEvent
  ) => {
    // Try multiple ISO code properties (TopoJSON can have different property names)
    const isoA3 = geo.properties.ISO_A3 || geo.properties.ISO3 || geo.properties.iso_a3
    let isoA2 = geo.properties.ISO_A2 || geo.properties.ISO2 || geo.properties.iso_a2

    // Fallback: Use Numeric ID mapping if standard properties are missing
    if ((!isoA2 && !isoA3) && geo.id && isoNumericToAlpha2[String(geo.id).padStart(3, '0')]) {
      isoA2 = isoNumericToAlpha2[String(geo.id).padStart(3, '0')]
    }

    let stat: CountryStat | undefined

    // Priority: Alpha-2 (Direct) > Alpha-3
    if (isoA2 && statsByAlpha2[isoA2]) {
      stat = statsByAlpha2[isoA2]
    } else if (isoA3 && statsByAlpha3[isoA3]) {
      stat = statsByAlpha3[isoA3]
    } else if (isoA3 && data?.alpha2ToAlpha3Map) {
      // Try reverse lookup: if we have Alpha-3, convert to Alpha-2
      const alpha2Codes = Object.keys(data.alpha2ToAlpha3Map)
      const matchingAlpha2 = alpha2Codes.find(code => data.alpha2ToAlpha3Map[code] === isoA3)
      if (matchingAlpha2 && statsByAlpha2[matchingAlpha2]) {
        stat = statsByAlpha2[matchingAlpha2]
      }
    }

    // Always show tooltip, even if no data (show 0)
    const countryName = stat?.countryName || geo.properties.NAME || geo.properties.name || "Unknown Region"

    setTooltip({
      countryName,
      totalDevices: stat?.totalDevices || 0,
      totalCredentials: stat?.totalCredentials || 0,
      x: 0, // Will be updated by mouse move
      y: 0,
    })
    const pos = calculateTooltipPosition(event.clientX, event.clientY)
    setTooltipStyle(pos)
  }

  // Handle geography mouse leave
  const handleGeographyMouseLeave = () => {
    setTooltip(null)
  }

  // Calculate smart tooltip positioning based on cursor position
  const calculateTooltipPosition = (clientX: number, clientY: number) => {
    if (typeof window === "undefined") {
      return { left: clientX, top: clientY - 10, transform: "translate(-50%, -100%)" }
    }

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const tooltipWidth = 220 // estimasi lebar tooltip (min-w-[200px] + padding)
    const tooltipHeight = 120 // estimasi tinggi tooltip
    const offset = 12 // offset dari cursor
    const margin = 20 // margin minimum dari edge viewport

    // Horizontal positioning
    let transformX: string
    let left: number | undefined
    let right: number | undefined

    // Cek ruang yang tersedia
    const spaceOnRight = viewportWidth - clientX
    const spaceOnLeft = clientX
    const halfTooltipWidth = tooltipWidth / 2

    // Hanya pindah ke kiri jika benar-benar akan terpotong (ruang di kanan < setengah tooltip + margin)
    // Atau jika cursor sangat dekat dengan edge kanan (> 85% viewport)
    const willBeClippedOnRight = spaceOnRight < halfTooltipWidth + margin
    const isVeryCloseToRightEdge = clientX > viewportWidth * 0.85

    // Hanya pindah ke kanan jika benar-benar akan terpotong (ruang di kiri < setengah tooltip + margin)
    // Atau jika cursor sangat dekat dengan edge kiri (< 15% viewport)
    const willBeClippedOnLeft = spaceOnLeft < halfTooltipWidth + margin
    const isVeryCloseToLeftEdge = clientX < viewportWidth * 0.15

    if (willBeClippedOnRight || isVeryCloseToRightEdge) {
      // Tooltip muncul di kiri cursor - gunakan right untuk positioning
      right = viewportWidth - clientX + offset
      transformX = "0%" // anchor ke kanan tooltip
    }
    else if (willBeClippedOnLeft || isVeryCloseToLeftEdge) {
      // Tooltip muncul di kanan cursor - gunakan left
      left = clientX + offset
      transformX = "0%" // anchor ke kiri tooltip
    }
    // Default: center di cursor (mayoritas kasus)
    else {
      left = clientX
      transformX = "-50%" // center horizontal
    }

    // Vertical positioning
    const spaceBelow = viewportHeight - clientY
    const spaceAbove = clientY
    let transformY: string
    let top: number | undefined

    // Jika cursor di bagian bawah (> 65% viewport) ATAU tidak cukup ruang di bawah
    if (clientY > viewportHeight * 0.65 || spaceBelow < tooltipHeight + margin) {
      // Tooltip muncul di atas cursor
      top = clientY - offset
      transformY = "-100%" // anchor ke bawah tooltip (muncul di atas)
    }
    // Jika cursor di bagian atas (< 35% viewport) ATAU tidak cukup ruang di atas
    else if (clientY < viewportHeight * 0.35 || spaceAbove < tooltipHeight + margin) {
      // Tooltip muncul di bawah cursor
      top = clientY + offset
      transformY = "0%" // anchor ke atas tooltip (muncul di bawah)
    }
    // Default: tooltip di atas cursor
    else {
      top = clientY - offset
      transformY = "-100%" // muncul di atas
    }

    return {
      ...(left !== undefined && { left }),
      ...(right !== undefined && { right }),
      ...(top !== undefined && { top }),
      transform: `translate(${transformX}, ${transformY})`,
    }
  }

  // Handle mouse move for tooltip following
  const handleMouseMove = (event: React.MouseEvent) => {
    if (tooltip) {
      const pos = calculateTooltipPosition(event.clientX, event.clientY)
      setTooltipStyle(pos)
    }
  }

  // Zoom controls
  const handleZoomIn = () => {
    if (position.zoom >= 4) return
    setPosition((pos) => ({
      ...pos,
      zoom: pos.zoom * 1.5,
    }))
  }

  const handleZoomOut = () => {
    if (position.zoom <= 1) return
    setPosition((pos) => ({
      ...pos,
      zoom: pos.zoom / 1.5,
    }))
  }

  const handleReset = () => {
    setPosition({ coordinates: [0, 0], zoom: 1.5 }) // Reset to default 1.5x
  }

  // Sync state when zoom/pan changes (including scroll zoom)
  const handleMoveEnd = (newPosition: { coordinates: [number, number]; zoom: number }) => {
    setPosition(newPosition)
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <Card className={`glass-card ${className || ""}`}>
        <CardHeader className="!p-4 border-b-[2px] border-border">
          <CardTitle className="flex items-center text-foreground text-lg leading-none">
            <Globe className="h-4 w-4 mr-2 text-blue-500 shrink-0" />
            Global Infection Map
          </CardTitle>
        </CardHeader>
        <CardContent className="!p-0" style={{ height: "505px" }}>
          <div className="relative bg-background rounded-b-lg overflow-hidden h-full">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-muted-foreground text-sm">Loading map data...</div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className={`glass-card ${className || ""}`}>
        <CardHeader className="!p-4 border-b-[2px] border-border">
          <CardTitle className="flex items-center text-foreground text-lg leading-none">
            <Globe className="h-4 w-4 mr-2 text-blue-500 shrink-0" />
            Global Infection Map
          </CardTitle>
        </CardHeader>
        <CardContent className="!p-0" style={{ height: "505px" }}>
          <div className="relative bg-background rounded-b-lg overflow-hidden h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-500 text-sm mb-2">Failed to load country statistics</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (!data || data.countryStats.length === 0) {
    return (
      <Card className={`glass-card ${className || ""}`}>
        <CardHeader className="!p-4 border-b-[2px] border-border">
          <CardTitle className="flex items-center text-foreground text-lg leading-none">
            <Globe className="h-4 w-4 mr-2 text-blue-500 shrink-0" />
            Global Infection Map
          </CardTitle>
        </CardHeader>
        <CardContent className="!p-0" style={{ height: "505px" }}>
          <div className="relative bg-background rounded-b-lg overflow-hidden h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">No country data available</p>
              <p className="text-xs text-muted-foreground mt-2">Upload some stealer logs to see country statistics</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`glass-card ${className || ""}`}>
      <CardHeader className="!p-4 border-b-[2px] border-border !flex-row !items-center justify-between space-y-0">
        <CardTitle className="flex items-center text-foreground text-lg">
          <Globe className="h-4 w-4 mr-2 text-blue-500 shrink-0" />
          Global Infection Map
        </CardTitle>
        {/* Zoom Controls in Header */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent/50"
            onClick={handleZoomIn}
            disabled={position.zoom >= 4}
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent/50"
            onClick={handleZoomOut}
            disabled={position.zoom <= 1}
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent/50"
            onClick={handleReset}
            title="Reset Zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="!p-0" style={{ height: "505px" }}>
        {/* Map Container - Full Height */}
        <div
          className="relative bg-background rounded-b-lg overflow-hidden h-full"
          onMouseMove={handleMouseMove}
        >
          <ComposableMap
            projectionConfig={{
              scale: 150,
              center: [0, 20],
            }}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup 
              zoom={position.zoom} 
              center={position.coordinates}
              onMoveEnd={handleMoveEnd}
            >
              {/* Tech Grid (Graticule) - Dotted lines for tech aesthetic */}
              <Graticule stroke="hsl(0 0% 30%)" strokeWidth={0.5} strokeDasharray="3 3" />
              <Geographies geography={geoUrl}>
                {({ geographies }: { geographies: Array<{
                  rsmKey: string
                  properties: {
                    NAME?: string
                    name?: string
                    ISO_A3?: string
                    ISO3?: string
                    iso_a3?: string
                    ISO_A2?: string
                    ISO2?: string
                    iso_a2?: string
                    [key: string]: any
                  }
                  id?: string | number
                }> }) =>
                  geographies.map((geo) => {
                    // Try multiple ISO code properties
                    const isoA3 = geo.properties.ISO_A3 || geo.properties.ISO3 || geo.properties.iso_a3
                    let isoA2 = geo.properties.ISO_A2 || geo.properties.ISO2 || geo.properties.iso_a2

                    // Fallback: Use Numeric ID mapping if standard properties are missing
                    if ((!isoA2 && !isoA3) && geo.id && isoNumericToAlpha2[String(geo.id).padStart(3, '0')]) {
                      isoA2 = isoNumericToAlpha2[String(geo.id).padStart(3, '0')]
                    }

                    let stat: CountryStat | undefined

                    // Priority: Alpha-2 (Direct) > Alpha-3
                    if (isoA2 && statsByAlpha2[isoA2]) {
                      stat = statsByAlpha2[isoA2]
                    } else if (isoA3 && statsByAlpha3[isoA3]) {
                      stat = statsByAlpha3[isoA3]
                    } else if (isoA3 && data?.alpha2ToAlpha3Map) {
                      // Try reverse lookup: if we have Alpha-3, convert to Alpha-2
                      const alpha2Codes = Object.keys(data.alpha2ToAlpha3Map)
                      const matchingAlpha2 = alpha2Codes.find(code => data.alpha2ToAlpha3Map[code] === isoA3)
                      if (matchingAlpha2 && statsByAlpha2[matchingAlpha2]) {
                        stat = statsByAlpha2[matchingAlpha2]
                      }
                    }

                    const deviceCount = stat?.totalDevices || 0
                    const fillColor = getCountryColor(deviceCount)

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fillColor}
                        stroke={MAP_COLORS.defaultStroke}
                        strokeWidth={0.5}
                        style={{
                          default: {
                            outline: "none",
                            transition: "all 0.2s ease",
                          },
                          hover: {
                            fill: MAP_COLORS.hoverFill,
                            outline: "none",
                            strokeWidth: 1.5,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          },
                          pressed: {
                            outline: "none",
                          },
                        }}
                        onClick={() => handleGeographyClick(geo)}
                        onMouseEnter={(e: React.MouseEvent) => handleGeographyMouseEnter(geo, e)}
                        onMouseLeave={handleGeographyMouseLeave}
                      />
                    )
                  })
                }

              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {/* Top 5 Countries (bottom-left) - Clean glassmorphic card */}
          <div className="absolute bottom-3 left-3 z-10">
            <div className="bg-card/40 backdrop-blur-md rounded-lg px-4 py-3 border-[1.5px] border-border/50">
              <div className="text-[10px] text-muted-foreground font-medium mb-2.5">
                Most Affected Countries
              </div>
              <div className="flex flex-col gap-1.5">
                {data.topCountries.slice(0, 5).map((country, index) => (
                  <div
                    key={country.country}
                    className="flex items-center gap-2.5 group"
                  >
                    {/* Rank */}
                    <span className={`text-[10px] font-bold w-4 ${index === 0 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
                      #{index + 1}
                    </span>
                    {/* Country Flag Emoji */}
                    <span className="text-sm">
                      {getCountryFlagEmoji(country.country)}
                    </span>
                    {/* Full Country Name */}
                    <span
                      className={`text-xs flex-1 min-w-[90px] ${index === 0 ? 'text-foreground font-medium' : 'text-foreground/80'} group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors cursor-default`}
                    >
                      {country.countryName}
                    </span>
                    {/* Device Count */}
                    <span
                      className={`text-xs font-bold ${index === 0 ? 'text-red-600 dark:text-red-300' : 'text-red-600/90 dark:text-red-300/90'}`}
                      style={index === 0 ? { textShadow: '0 0 8px rgba(239, 68, 68, 0.4)' } : {}}
                    >
                      {country.totalDevices.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Density Legend - Bottom right */}
          <div className="absolute bottom-3 right-3 z-10">
            <div className="bg-card/60 backdrop-blur-md rounded-full px-4 py-1.5 border-[1.5px] border-border/50 flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground font-medium">
                Density
              </span>
              <div className="flex items-center">
                <span className="text-[9px] text-muted-foreground mr-1.5">Low</span>
                <div className="flex items-center">
                  {MAP_COLORS.heatScale.map((color, index) => (
                    <div
                      key={index}
                      className="w-5 h-2"
                      style={{
                        backgroundColor: color,
                        borderRadius: index === 0 ? '2px 0 0 2px' : index === MAP_COLORS.heatScale.length - 1 ? '0 2px 2px 0' : '0'
                      }}
                    />
                  ))}
                </div>
                <span className="text-[9px] text-slate-500 ml-1.5">High</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Tooltip with React Portal - ensures it's not clipped by overflow-hidden */}
      {typeof window !== "undefined" && tooltip && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed z-[9999] pointer-events-none"
            style={{
              ...(tooltipStyle.left !== undefined && { left: `${tooltipStyle.left}px` }),
              ...(tooltipStyle.right !== undefined && { right: `${tooltipStyle.right}px` }),
              ...(tooltipStyle.top !== undefined && { top: `${tooltipStyle.top}px` }),
              ...(tooltipStyle.bottom !== undefined && { bottom: `${tooltipStyle.bottom}px` }),
              transform: tooltipStyle.transform,
            }}
          >
            <div className="bg-card/90 backdrop-blur-md rounded-lg p-3 border-[1.5px] border-border/60 shadow-xl min-w-[200px]">
              <div className="font-semibold text-foreground text-sm mb-2">
                {tooltip.countryName}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Devices:</span>
                  <span className="text-red-500 font-medium">
                    {tooltip.totalDevices.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credentials:</span>
                  <span className="text-amber-500 font-medium">
                    {tooltip.totalCredentials.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </Card>
  )
}
