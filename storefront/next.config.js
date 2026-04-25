const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    staticGenerationRetryCount: 3,
    staticGenerationMaxConcurrency: 1,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      // TODO: reemplazar con el bucket S3 del cliente en producción
      // { protocol: "https", hostname: "tu-bucket.s3.region.amazonaws.com" },
    ],
  },
}

module.exports = nextConfig
