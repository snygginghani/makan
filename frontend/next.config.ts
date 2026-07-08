import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lean production image for Docker (only ships the server + used deps).
  output: "standalone",
};

export default nextConfig;
