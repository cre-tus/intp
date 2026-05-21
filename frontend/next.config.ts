import type { NextConfig } from "next";
import {webpack} from "next/dist/compiled/webpack/webpack";

const nextConfig: NextConfig = {
  /* config options here */
    allowedDevOrigins: ["tuk-intp.kro.kr", "39.120.123.99"],
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
