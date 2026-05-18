/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  env: {
    NEXT_PUBLIC_PARTYKIT_HOST:
      process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999",
  },
};

export default nextConfig;
