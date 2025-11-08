import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { logInfo, logError } from "@/lib/logger"
import { deviceCredentialsSchema, validateData, createValidationErrorResponse } from "@/lib/validation"
import { validateRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Validate input
    const validation = validateData(deviceCredentialsSchema, body)
    if (!validation.success) {
      logError("Validation failed for device files request", validation.errors, 'Device Files API')
      return NextResponse.json(createValidationErrorResponse(validation.errors), { status: 400 })
    }

    const { deviceId } = validation.data
    logInfo(`Loading files for device: ${deviceId}`, undefined, 'Device Files API')

    // First, verify the device exists and get device info
    const deviceCheck = (await executeQuery(
      "SELECT device_id, device_name, upload_batch, total_files FROM devices WHERE device_id = ?",
      [deviceId],
    )) as any[]

    console.log("📱 Device check result:", deviceCheck)

    if (deviceCheck.length === 0) {
      console.log("❌ Device not found:", deviceId)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const device = deviceCheck[0]

    // Get all files for this device
    const files = (await executeQuery(
      `SELECT 
        file_path,
        file_name,
        COALESCE(parent_path, '') as parent_path,
        is_directory,
        COALESCE(file_size, 0) as file_size,
        CASE 
          WHEN content IS NOT NULL OR local_file_path IS NOT NULL THEN TRUE 
          ELSE FALSE 
        END as has_content
       FROM files 
       WHERE device_id = ? 
       ORDER BY file_path`,
      [deviceId],
    )) as any[]

    console.log(`📊 Found ${files.length} files for device ${deviceId}`)

    // Format files for display
    const formattedFiles = files.map((file) => ({
      file_path: file.file_path || "",
      file_name: file.file_name || "",
      parent_path: file.parent_path || "",
      is_directory: file.is_directory || false,
      file_size: file.file_size || 0,
      has_content: file.has_content || false,
    }))

    // Return device info with files
    const result = {
      deviceId: device.device_id,
      deviceName: device.device_name,
      uploadBatch: device.upload_batch,
      totalFiles: device.total_files || files.length,
      files: formattedFiles,
      matchingFiles: [], // Empty for now, can be populated if needed
      matchedContent: [], // Empty for now, can be populated if needed
    }

    console.log(`✅ Returning device files data with ${formattedFiles.length} files`)

    return NextResponse.json(result)
  } catch (error) {
    console.error("❌ Error loading device files:", error)
    return NextResponse.json(
      {
        error: "Failed to load files",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

