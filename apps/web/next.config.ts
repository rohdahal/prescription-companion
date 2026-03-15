import type { NextConfig } from "next";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.join(__dirname, "../..");

dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config({ path: path.join(workspaceRoot, ".env.local"), override: false });

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot
};

export default nextConfig;
