/** @type {import('next').NextConfig} */
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  // Enable instrumentation hook for global error handlers
  experimental: {
    instrumentationHook: true,
    webpackBuildWorker: true, // Use separate worker process for faster builds
    // Exclude large data folders from output file tracing (fixes slow builds)
    outputFileTracingExcludes: {
      '*': [
        './uploads/**',
        './clickhouse-data/**',
        './mysql-data/**',
        './.devtasks/**',
      ],
    },
  },
  // Exclude data folders from webpack processing (these contain stealer logs with .ts files)
  webpack: (config, { isServer }) => {
    // Ignore data directories from file watching
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/uploads/**', '**/clickhouse-data/**', '**/mysql-data/**', '**/node_modules/**'],
    };
    
    // Add rule to completely ignore data folders from module bundling
    config.module.rules.push({
      test: /\.(ts|tsx|js|jsx|json)$/,
      exclude: [
        path.resolve('./uploads'),
        path.resolve('./clickhouse-data'),
        path.resolve('./mysql-data'),
      ],
    });

    // Exclude from snapshot paths to prevent webpack from scanning data dirs
    if (!config.snapshot) config.snapshot = {};
    config.snapshot.managedPaths = config.snapshot.managedPaths || [/node_modules/];
    config.snapshot.immutablePaths = config.snapshot.immutablePaths || [];
    
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
          // SECURITY: Add HSTS header (MED-18)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // SECURITY: Add Content-Security-Policy (MED-18)
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://cdn.jsdelivr.net; frame-ancestors 'none';",
          },
          // SECURITY: Add Permissions-Policy header (MED-18)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
