const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Genera en .next/standalone un servidor con solo las dependencias que el
  // código usa de verdad. Es lo que permite que la imagen Docker no arrastre
  // los node_modules enteros (cientos de MB de los que en producción no se
  // ejecuta casi ninguno). No afecta a `yarn dev` ni a `yarn start` en local.
  output: "standalone",
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
