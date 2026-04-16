/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@levelup/motion', '@levelup/shared'],
  async rewrites() {
    const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
