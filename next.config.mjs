/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  // Enable standalone output for smaller Docker images (production only)
  ...(isDev ? {} : { output: 'standalone' }),
  // Bundle optimization (only in production - not compatible with Turbo)
  swcMinify: true,
  ...(!isDev ? {
    compiler: {
      removeConsole: {
        exclude: ['error', 'warn']
      },
    },
  } : {}),
  eslint: {
    // Only ignore during builds in development, not production
    ignoreDuringBuilds: isDev,
  },
  typescript: {
    // Only ignore build errors in development, not production
    ignoreBuildErrors: isDev,
  },
  images: {
    unoptimized: true,
  },
  // Add performance optimizations for faster dev
  experimental: {
    // Turbopack optimizations
    ...(isDev ? {
      // Faster refresh in development
      turbo: {
        rules: {
          // Optimize module resolution
        },
      },
    } : {}),
  },
  // Optimize module resolution for faster startup (only in production - not compatible with Turbo)
  ...(!isDev ? {
    modularizeImports: {
      'lucide-react': {
        transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      },
    },
  } : {}),
  // Add security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

export default nextConfig
