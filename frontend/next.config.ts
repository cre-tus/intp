import type { NextConfig } from "next";
import {webpack} from "next/dist/compiled/webpack/webpack";

const nextConfig: NextConfig = {
  /* config options here */
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
