import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (
  process.env.NODE_ENV === "development" &&
  process.env.ENABLE_CF_DEV === "true"
) {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
