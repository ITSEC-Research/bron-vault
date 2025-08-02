"use client"

import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface FileContentDialogProps {
  selectedFile: { deviceId: string; filePath: string; fileName: string } | null
  onClose: () => void
  fileContent: string
  isLoadingFile: boolean
  selectedFileType: 'text' | 'image' | null
  deviceName?: string
}

export function FileContentDialog({
  selectedFile,
  onClose,
  fileContent,
  isLoadingFile,
  selectedFileType,
  deviceName,
}: FileContentDialogProps) {
  if (!selectedFile) return null

  return (
    <Dialog open={!!selectedFile} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-bron-bg-secondary border border-bron-border">
        <DialogHeader>
          <DialogTitle className="text-bron-text-primary">{selectedFile.fileName}</DialogTitle>
          <DialogDescription className="text-bron-text-muted">
            Device: {deviceName}
          </DialogDescription>
        </DialogHeader>
        <div className="h-[60vh] w-full overflow-y-auto overflow-x-auto">
          {isLoadingFile ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-bron-text-primary">Loading file content...</p>
            </div>
          ) : selectedFileType === 'image' ? (
            <div className="overflow-x-auto">
              <img 
                src={fileContent} 
                alt={selectedFile.fileName} 
                className="max-w-full max-h-full object-contain" 
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono bg-bron-bg-tertiary p-4 rounded border border-bron-border text-bron-text-primary min-w-max">
                {fileContent}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
