import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: "../../",
  },

  serverExternalPackages: ["@prisma/client", "@prisma/engines"],
};

export default nextConfig;