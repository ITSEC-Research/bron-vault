import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { deviceId } = await request.json()

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    // Get device info
    const deviceInfo = (await executeQuery(
      "SELECT device_id, device_name, upload_batch, upload_date FROM devices WHERE device_id = ?",
      [deviceId],
    )) as any[]

    if (deviceInfo.length === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const device = deviceInfo[0]

    // Get system information from systeminformation table
    const systemInfo = (await executeQuery(
      `
      SELECT os, computer_name, ip_address, country, file_path, username
      FROM systeminformation
      WHERE device_id = ?
      LIMIT 1
    `,
      [deviceId],
    )) as any[]

    const response: any = {
      deviceId: device.device_id,
      deviceName: device.device_name,
      uploadBatch: device.upload_batch,
      uploadDate: device.upload_date,
    }

    // Add system information if available
    if (systemInfo.length > 0) {
      const sysInfo = systemInfo[0]
      response.operatingSystem = sysInfo.os || undefined
      response.hostname = sysInfo.computer_name || undefined
      response.ipAddress = sysInfo.ip_address || undefined
      response.country = sysInfo.country || undefined
      response.filePath = sysInfo.file_path || undefined
      response.username = sysInfo.username || undefined
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error loading device info:", error)
    return NextResponse.json(
      {
        error: "Failed to load device info",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

