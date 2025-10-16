import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Increase body size limit for file uploads (50MB)
    bodySizeLimit: '50mb',
  },
};

export default nextConfig;
