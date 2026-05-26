import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.zegocloud.com https://*.zego.im",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com",
              "media-src 'self' blob: https://*.supabase.co",
              // wss: (qualquer WebSocket seguro) é necessário porque o ZegoCloud
              // conecta os servidores de mídia em endpoints dinâmicos (IPs/subdomínios
              // fora de *.zego.im) via WebSocket. Os destinos https seguem restritos.
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.stripe.com https://*.zegocloud.com wss://*.zegocloud.com https://*.zego.im wss://*.zego.im wss: https://*.sentry.io https://*.ingest.sentry.io https://viacep.com.br",
              "frame-src 'self' https://*.stripe.com https://*.zegocloud.com",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
});
