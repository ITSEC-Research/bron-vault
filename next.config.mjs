/** @type {import('next').NextConfig} */
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  // Enable instrumentation hook for global error handlers
  experimental: {
    instrumentationHook: true,
    webpackBuildWorker: true, // Use separate worker process for faster builds
  },
  // Exclude data folders from webpack processing (these contain stealer logs with .ts files)
  webpack: (config, { isServer }) => {
    // Ignore data directories from module resolution
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/uploads/**', '**/clickhouse-data/**', '**/mysql-data/**', '**/node_modules/**'],
    };
    
    // Add rule to completely ignore data folders
    config.module.rules.push({
      test: /\.(ts|tsx|js|jsx|json)$/,
      exclude: [
        /uploads/,
        /clickhouse-data/,
        /mysql-data/,
      ],
    });
    
    return config;
  },
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
