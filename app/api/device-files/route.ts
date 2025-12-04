import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
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

    // First, verify the device exists and get device info (ClickHouse)
    // NOTE: device_id is VARCHAR(255) in schema, so {deviceId:String} is correct
    const deviceCheck = (await executeClickHouseQuery(
      "SELECT device_id, device_name, upload_batch, total_files FROM devices WHERE device_id = {deviceId:String}",
      { deviceId },
    )) as any[]

    console.log("📱 Device check result:", deviceCheck)

    if (deviceCheck.length === 0) {
      console.log("❌ Device not found:", deviceId)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const device = deviceCheck[0]

    // Get all files for this device (ClickHouse)
    // Only files with local_file_path (all files should be migrated to disk)
    // NOTE: device_id is VARCHAR(255) in schema, so {deviceId:String} is correct
    // NOTE: has_content returns 1 or 0 (Number) - will be converted to Boolean in mapping
    const files = (await executeClickHouseQuery(
      `SELECT 
        file_path,
        file_name,
        coalesce(parent_path, '') as parent_path,
        is_directory,
        coalesce(file_size, 0) as file_size,
        if(local_file_path IS NOT NULL, 1, 0) as has_content,
        file_type
       FROM files 
       WHERE device_id = {deviceId:String} 
       ORDER BY file_path`,
      { deviceId },
    )) as any[]

    console.log(`📊 Found ${files.length} files for device ${deviceId}`)

    // Format files for display
    // Note: has_content dari ClickHouse adalah 1 atau 0 (Number), perlu convert ke Boolean
    const formattedFiles = files.map((file) => ({
      file_path: file.file_path || "",
      file_name: file.file_name || "",
      parent_path: file.parent_path || "",
      is_directory: file.is_directory || false,
      file_size: file.file_size || 0,
      // Convert Number (1/0) to Boolean explicitly
      has_content: Boolean(file.has_content && file.has_content !== 0),
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

