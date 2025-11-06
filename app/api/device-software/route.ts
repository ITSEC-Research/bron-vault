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
      logError("Validation failed for device software request", validation.errors, 'Device Software API')
      return NextResponse.json(createValidationErrorResponse(validation.errors), { status: 400 })
    }

    const { deviceId } = validation.data
    logInfo(`Loading software for device: ${deviceId}`, undefined, 'Device Software API')

    // First, verify the device exists
    const deviceCheck = (await executeQuery("SELECT device_id, device_name FROM devices WHERE device_id = ?", [
      deviceId,
    ])) as any[]

    console.log("📱 Device check result:", deviceCheck)

    if (deviceCheck.length === 0) {
      console.log("❌ Device not found:", deviceId)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    // Get software installed for this device
    const software = (await executeQuery(
      `SELECT 
        COALESCE(software_name, 'Unknown') as software_name,
        COALESCE(version, '') as version,
        COALESCE(source_file, '') as source_file
       FROM software 
       WHERE device_id = ? 
       ORDER BY software_name, version`,
      [deviceId],
    )) as any[]

    console.log(`📊 Found ${software.length} software entries for device ${deviceId}`)

    // Format software for display
    const formattedSoftware = software.map((sw) => ({
      software_name: sw.software_name || "Unknown",
      version: sw.version || "",
      source_file: sw.source_file || "",
    }))

    console.log(`✅ Returning ${formattedSoftware.length} formatted software entries`)

    return NextResponse.json(formattedSoftware)
  } catch (error) {
    console.error("❌ Error loading device software:", error)
    return NextResponse.json(
      {
        error: "Failed to load software",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

