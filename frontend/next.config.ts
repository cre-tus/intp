import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /* config options here */
    allowedDevOrigins: ["tuk-intp.kro.kr", "39.120.123.99"],
    outputFileTracingRoot: path.join(process.cwd(), ".."),
    webpack: config =>  {
        config.watchOptions = {
            poll: 1000,
            aggregateTimeout: 200,
            ignored: /node_modules/,
        }
        return config;
    }
};

export default nextConfig;
