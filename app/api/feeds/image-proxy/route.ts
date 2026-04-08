export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get('url')

  if (!imageUrl || !imageUrl.startsWith('http')) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  try {
    const parsedUrl = new URL(imageUrl)
    
    // 1. Protocol Validation
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: "Invalid protocol. Only HTTP and HTTPS are allowed." }, { status: 400 })
    }

    // 2. Hostname Validation (Basic SSRF Prevention)
    const hostname = parsedUrl.hostname.toLowerCase()
    
    // Tolak hostname yang tidak memiliki dot (biasanya internal network hostname, misal http://database)
    // Tolak juga IP Address lokal / private range seperti 10.x, 192.168.x, 127.0.0.1
    if (
      !hostname.includes('.') ||
      hostname === '127.0.0.1' || 
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') || 
      hostname.startsWith('192.168.') || 
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) || // 172.16.0.0/12
      hostname === '169.254.169.254' || // AWS Metadata service
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return NextResponse.json({ error: "Blocked internal network request (SSRF Protection)" }, { status: 403 })
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BronVault/1.0)',
        'Accept': 'image/webp,image/avif,image/jpeg,image/png,image/gif,image/svg+xml,image/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
      // Mencegah fetch redirect ke target yang membahayakan
      redirect: 'follow', 
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 })
    }

    const contentType = response.headers.get('content-type') || ''
    
    // 3. Strict Content-Type Validation (XSS & Data Leak Prevention)
    // Ini pastikan endpoint yang dipanggil hanyalah valid resource gambar.
    if (!contentType.toLowerCase().startsWith('image/')) {
      return NextResponse.json({ error: "Invalid content type. Only images are allowed." }, { status: 403 })
    }

    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        // 4. Security Headers to prevent browser from interpreting image payload as HTML/Scripts
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'",
        'Content-Disposition': 'inline'
      },
    })
  } catch (_err) {
    return NextResponse.json({ error: "Failed to proxy image" }, { status: 502 })
  }
}
