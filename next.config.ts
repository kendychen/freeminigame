import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/videos/admin", destination: "/admin/videos", permanent: true }];
  },
};

export default nextConfig;
