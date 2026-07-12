/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // bip39 calls Buffer.from() internally; polyfill it for the browser bundle.
      // (@noble/hashes and ed25519-hd-key are pure JS and need no Node core module shims.)
      config.plugins.push(
        new webpack.ProvidePlugin({ Buffer: ["buffer", "Buffer"] })
      );
      config.resolve.fallback = { ...config.resolve.fallback, crypto: false, stream: false };
    }
    return config;
  },
};
export default nextConfig;
