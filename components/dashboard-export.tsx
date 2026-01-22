"use client"

import { useState } from "react"
import { Download, FileText, FileDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exportToHTML, downloadHTML, exportToPDF, DashboardExportData } from "@/lib/export-utils"
import { toast } from "sonner"

interface DashboardExportProps {
  exportData: DashboardExportData
  dashboardElementId?: string
}

export function DashboardExport({
  exportData,
  dashboardElementId = "dashboard-content",
}: DashboardExportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleExportHTML = async () => {
    setIsExporting(true)
    try {
      const html = await exportToHTML(exportData)
      downloadHTML(html)
      toast.success("Dashboard exported to HTML successfully")
    } catch (error) {
      console.error("Error exporting HTML:", error)
      toast.error("Failed to export dashboard to HTML")
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      await exportToPDF(dashboardElementId, exportData)
      toast.success("Dashboard exported to PDF successfully")
    } catch (error) {
      console.error("Error exporting PDF:", error)
      toast.error("Failed to export dashboard to PDF")
    } finally {
      setIsExporting(false)
    }
  }

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
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={isExporting}
            className="gap-2 h-9 hover:border-primary hover:bg-primary/10 hover:text-primary transition-all"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-50 shadow-2xl border-2">
          <DropdownMenuItem
            onClick={handleExportHTML}
            disabled={isExporting}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Export as HTML
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleExportPDF}
            disabled={isExporting}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            Export as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
