const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 14 já usa appDir automaticamente quando existe /app
  transpilePackages: ['undici'],
  reactStrictMode: true,
  eslint: {
    // No Vercel o lint falha se plugins não estiverem instalados.
    // Mantém o build rodando (typescript ainda valida types).
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Garante que no client o resolver prefira builds "browser" quando existirem
    if (!isServer) {
      config.resolve.conditionNames = ['browser', 'import', 'module', 'require', 'default']
    }
    return config
  },
}

module.exports = withPWA(nextConfig)
