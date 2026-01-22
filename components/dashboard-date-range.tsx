"use client"

import { useState, useEffect } from "react"
import { CalendarIcon, X, ChevronLeft, ChevronRight } from "lucide-react"
import { format, startOfMonth, setMonth, setYear, getMonth, getYear } from "date-fns"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  DateRangeType,
  DateRangePreset,
  getPresetDateRange,
  getPresetLabel,
  formatDateRangeLabel,
} from "@/lib/date-range-utils"
import { DateRange, CaptionProps } from "react-day-picker"

interface DashboardDateRangeProps {
  value: DateRangeType | null
  onChange: (range: DateRangeType | null) => void
  className?: string
}

const PRESETS: DateRangePreset[] = [
  "today",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "last_6_months",
  "last_year",
]

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

// Custom Caption component with month and year dropdowns
function CustomCaption(props: CaptionProps & { onMonthChange?: (date: Date) => void }) {
  const { displayMonth, onMonthChange } = props
  const currentYear = getYear(displayMonth)
  const currentMonthIndex = getMonth(displayMonth)
  
  // Generate years (current year ± 10 years)
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i)

  const handleMonthChange = (monthIndex: number) => {
    if (onMonthChange) {
      onMonthChange(startOfMonth(setMonth(displayMonth, monthIndex)))
    }
  }

  const handleYearChange = (year: number) => {
    if (onMonthChange) {
      onMonthChange(startOfMonth(setYear(displayMonth, year)))
    }
  }

  const handlePrevMonth = () => {
    if (onMonthChange) {
      onMonthChange(startOfMonth(setMonth(displayMonth, currentMonthIndex - 1)))
    }
  }

  const handleNextMonth = () => {
    if (onMonthChange) {
      onMonthChange(startOfMonth(setMonth(displayMonth, currentMonthIndex + 1)))
    }
  }

  return (
    <div className="flex items-center justify-between mb-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handlePrevMonth}
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center gap-2">
        <Select
          value={currentMonthIndex.toString()}
          onValueChange={(value) => handleMonthChange(parseInt(value))}
        >
          <SelectTrigger className="w-[130px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((month, index) => (
              <SelectItem key={month} value={index.toString()}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select
          value={currentYear.toString()}
          onValueChange={(value) => handleYearChange(parseInt(value))}
        >
          <SelectTrigger className="w-[100px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleNextMonth}
        type="button"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function DashboardDateRange({
  value,
  onChange,
  className,
}: DashboardDateRangeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined)
  const [activeTab, setActiveTab] = useState("select-dates")
  const [month, setMonth] = useState<Date>(new Date())
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset | null>(null)
  const [initialCustomRange, setInitialCustomRange] = useState<DateRange | undefined>(undefined)

  // Sync customRange with value when it's a custom range or when modal opens
  useEffect(() => {
    if (isOpen) {
      // When popover opens, save the initial state
      if (value?.type === "custom") {
        const initialRange = {
          from: value.start,
          to: value.end,
        }
        setCustomRange(initialRange)
        setInitialCustomRange(initialRange)
      } else {
        setCustomRange(undefined)
        setInitialCustomRange(undefined)
      }
    } else {
      // Reset when modal closes
      setCustomRange(undefined)
      setInitialCustomRange(undefined)
    }
  }, [value, isOpen])

  // Sync selectedPreset with value when it's a preset or when modal opens
  useEffect(() => {
    if (value?.type === "preset") {
      setSelectedPreset(value.preset)
    } else if (!isOpen) {
      // Reset when modal closes
      setSelectedPreset(null)
    }
  }, [value, isOpen])

  const handlePresetSelect = (preset: DateRangePreset) => {
    // Only update temporary state, don't call onChange yet
    setSelectedPreset(preset)
  }

  const handleApplyPreset = () => {
    if (selectedPreset) {
      onChange({ type: "preset", preset: selectedPreset })
      setIsOpen(false)
    }
  }

  const handleCancelPreset = () => {
    // Reset to current value
    if (value?.type === "preset") {
      setSelectedPreset(value.preset)
    } else {
      setSelectedPreset(null)
    }
  }

  const handleCustomRangeSelect = (range: DateRange | undefined) => {
    // Only update temporary state, don't call onChange yet
    setCustomRange(range)
  }

  const handleApply = () => {
    if (customRange?.from && customRange?.to) {
      onChange({
        type: "custom",
        start: customRange.from,
        end: customRange.to,
      })
      setIsOpen(false)
    }
  }

  const handleCancel = () => {
    // Reset to initial value when popover was opened - clear the calendar selection
    setCustomRange(initialCustomRange)
  }

  const handleClear = () => {
    onChange(null)
    setCustomRange(undefined)
  }

  const hasValue = value !== null

  return (
    <>
      {/* Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal h-9 hover:border-primary hover:bg-primary/10 hover:text-primary transition-all",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {hasValue ? (
              <span className="flex items-center gap-2">
                {formatDateRangeLabel(value)}
                {hasValue && (
                  <X
                    className="h-3 w-3 opacity-50 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClear()
                    }}
                  />
                )}
              </span>
            ) : (
              <span>Select Date Range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[640px] p-0 shadow-2xl border-2 bg-background z-50" 
          align="start"
        >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b px-3 pt-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="select-dates">Select Dates</TabsTrigger>
              <TabsTrigger value="custom-ranges">Custom Ranges</TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Select Dates (Calendar) */}
          <TabsContent value="select-dates" className="p-4 m-0">
            <div className="px-2 py-1.5 text-sm font-semibold mb-3">Select Date Range</div>
            <div className="w-full px-2">
              <CalendarComponent
                mode="range"
                selected={customRange}
                onSelect={handleCustomRangeSelect}
                month={month}
                onMonthChange={setMonth}
                numberOfMonths={2}
                className="rounded-md border-0 w-full p-0"
                components={{
                  Caption: (props) => <CustomCaption {...props} onMonthChange={setMonth} />,
                }}
                classNames={{
                  months: "flex flex-row space-x-4 sm:space-x-4 justify-center w-full",
                  month: "space-y-4",
                  caption: "hidden", // Hide default caption since we use custom
                  table: "w-full border-collapse space-y-1 mx-auto",
                  head_row: "flex justify-center",
                  head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",
                  row: "flex w-full mt-2 justify-center",
                  cell: "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center [&:has([aria-selected].day-range-start)]:bg-primary/20 [&:has([aria-selected].day-range-end)]:bg-primary/20",
                  day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 flex items-center justify-center",
                  day_selected:
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold",
                  day_range_start:
                    "bg-primary text-primary-foreground font-semibold !bg-primary !text-primary-foreground",
                  day_range_end:
                    "bg-primary text-primary-foreground font-semibold !bg-primary !text-primary-foreground",
                  day_range_middle:
                    "!bg-primary/20 !text-primary/70",
                }}
              />
            </div>
            <div className="mt-3 pt-3 border-t">
              {customRange?.from && customRange?.to ? (
                <>
                  <div className="text-xs text-muted-foreground px-2 mb-3">
                    {format(customRange.from, "MMM d, yyyy")} - {format(customRange.to, "MMM d, yyyy")}
                  </div>
                  <div className="flex gap-2 px-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleApply}
                    >
                      Apply
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground px-2 py-2 text-center">
                  Select a date range to continue
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 2: Custom Ranges (Presets) */}
          <TabsContent value="custom-ranges" className="p-4 m-0">
            <p className="text-sm text-muted-foreground mb-3">Select a predefined time range:</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset
                
                return (
                  <button
                    key={preset}
                    onClick={() => handlePresetSelect(preset)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-colors border",
                      "bg-accent/50 border-border hover:bg-primary hover:border-primary hover:text-primary-foreground",
                      "text-foreground",
                      isSelected && "bg-primary text-primary-foreground border-primary"
                    )}
                  >
                    {getPresetLabel(preset)}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 pt-4 border-t">
              {selectedPreset ? (
                <>
                  <div className="px-2 py-1.5 text-sm font-semibold mb-2">
                    {getPresetLabel(selectedPreset)}
                  </div>
                  {(() => {
                    const range = getPresetDateRange(selectedPreset)
                    if (!range) return null
                    return (
                      <div className="text-xs text-muted-foreground px-2 mb-3">
                        {format(range.start, "MMM d, yyyy")} - {format(range.end, "MMM d, yyyy")}
                      </div>
                    )
                  })()}
                  <div className="flex gap-2 px-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={handleCancelPreset}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleApplyPreset}
                    >
                      Apply
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground px-2 py-2 text-center">
                  Select a preset range to continue
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
    </>
  )
}
