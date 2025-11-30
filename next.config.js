/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['tailwind-merge'],
  // Allow build to proceed with ESLint warnings
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Uncomment the line below for static export (Firebase Hosting)
  // output: 'export',
  // images: {
  //   unoptimized: true,
  // },
  webpack: (config, { isServer }) => {
    // Ensure tailwind-merge is properly handled
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;

