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
      logError("Validation failed for device credentials request", validation.errors, 'Device Credentials API')
      return NextResponse.json(createValidationErrorResponse(validation.errors), { status: 400 })
    }

    const { deviceId } = validation.data
    logInfo(`Loading credentials for device: ${deviceId}`, undefined, 'Device Credentials API')

    // First, verify the device exists (ClickHouse)
    // NOTE: device_id is VARCHAR(255) in schema, so {deviceId:String} is correct
    const deviceCheck = (await executeClickHouseQuery(
      "SELECT device_id, device_name FROM devices WHERE device_id = {deviceId:String}",
      { deviceId }
    )) as any[]

    console.log("📱 Device check result:", deviceCheck)

    if (deviceCheck.length === 0) {
      console.log("❌ Device not found:", deviceId)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    // ENHANCED: Get credentials with flexible browser handling (ClickHouse)
    // NOTE: device_id is VARCHAR(255) in schema, so {deviceId:String} is correct
    const credentials = (await executeClickHouseQuery(
      `SELECT 
        coalesce(browser, 'Unknown') as browser,
        coalesce(url, '') as url, 
        coalesce(username, '') as username, 
        coalesce(password, '') as password,
        file_path
       FROM credentials 
       WHERE device_id = {deviceId:String} 
       ORDER BY url, username`,
      { deviceId },
    )) as any[]

    console.log(`📊 Found ${credentials.length} credentials for device ${deviceId}`)

    // Debug: Check total credentials in database (ClickHouse)
    const totalCredentials = (await executeClickHouseQuery("SELECT count() as count FROM credentials")) as any[]
    console.log(`📊 Total credentials in database: ${JSON.stringify(totalCredentials)}`)

    // Debug: Check credentials with device info (ClickHouse)
    const credentialsWithDevice = (await executeClickHouseQuery(
      `SELECT c.*, d.device_name 
       FROM credentials c 
       INNER JOIN devices d ON c.device_id = d.device_id 
       WHERE c.device_id = {deviceId:String}`,
      { deviceId },
    )) as any[]

    console.log(`🔍 Credential details with device info: ${JSON.stringify(credentialsWithDevice)}`)

    // Format credentials for display - Handle missing browser gracefully
    const formattedCredentials = credentials.map((cred) => ({
      browser: cred.browser === "Unknown" || !cred.browser ? null : cred.browser,
      url: cred.url || "",
      username: cred.username || "",
      password: cred.password || "",
      filePath: cred.file_path || "",
    }))

    console.log(`✅ Returning ${formattedCredentials.length} formatted credentials`)

    return NextResponse.json(formattedCredentials)
  } catch (error) {
    console.error("❌ Error loading device credentials:", error)
    return NextResponse.json(
      {
        error: "Failed to load credentials",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
