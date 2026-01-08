"use client"

import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
      <DialogContent className="max-w-4xl max-h-[80vh] glass-modal">
        <DialogHeader>
          <DialogTitle className="text-foreground">{selectedFile.fileName}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Device: {deviceName}
          </DialogDescription>
        </DialogHeader>
        <div className="h-[60vh] w-full overflow-y-auto overflow-x-auto [scrollbar-width:thin] [scrollbar-color:hsl(var(--primary)/0.3)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-primary/50">
          {isLoadingFile ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-foreground">Loading file content...</p>
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
              <pre className="text-xs whitespace-pre-wrap font-mono bg-card/50 p-4 rounded border border-border text-foreground min-w-max">
                {fileContent}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
