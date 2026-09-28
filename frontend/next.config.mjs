/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Standalone output — bundles only the traced dependencies a `node
  // server.js` needs into .next/standalone, so the production Docker image
  // doesn't have to ship the full node_modules tree. See Dockerfile.
  output: 'standalone',
};

export default nextConfig;
