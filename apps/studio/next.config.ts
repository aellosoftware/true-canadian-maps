import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: root,
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@tcm/shared", "@tcm/db", "@tcm/style-compiler", "@tcm/icons"],
  serverExternalPackages: ["pg", "pg-boss", "pino"],
  experimental: {
    // keep map libraries out of the server bundle
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
