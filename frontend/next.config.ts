import type { NextConfig } from 'next';

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
// Client bundle uses NEXT_PUBLIC_API_URL as-is (relative '/api/v1' works via nginx same-origin).
// Server-side rewrites need an absolute backend URL: fall back to internal Docker DNS name
// when the public URL is relative (e.g. '/api/v1' -> '' after stripping the suffix).
const STRIPPED = RAW_API_URL.replace('/api/v1', '');
const API_BASE = STRIPPED === '' ? 'http://api:4000' : STRIPPED;

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
