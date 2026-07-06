import type { NextConfig } from 'next';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace('/api/v1', '');

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@cordlyx/shared'],
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: `${API_BASE}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
