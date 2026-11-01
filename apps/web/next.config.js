/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@docauth/shared', '@docauth/crypto'],
  reactStrictMode: true,
};

module.exports = nextConfig;

