import type { NextConfig } from "next";

// Static export: `next build` writes plain HTML/JS/CSS to ./out, served by Cloudflare (see wrangler.jsonc).
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
