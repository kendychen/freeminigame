import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        // Anonymous referee + share-link routes are private by token; not
        // indexable. Auth-only admin paths block too. Score boards by code
        // are also user-private.
        disallow: [
          "/api/",
          "/auth/",
          "/admin/",
          "/dashboard",
          "/dashboard/",
          "/r/",
          "/pair/",
          "/score/",
          "/t/*/admin",
          "/t/*/admin/*",
          "/t/*/referee",
          "/t/*/referee/*",
          "/quick/share/",
          "/quick/bracket",
          "/display/",
          "/embed/",
          "/s/",
        ],
      },
    ],
    sitemap: "https://hoinhompick.team/sitemap.xml",
    host: "https://hoinhompick.team",
  };
}
