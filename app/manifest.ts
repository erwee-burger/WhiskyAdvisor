import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Whisky Advisor",
    short_name: "Whisky",
    description: "Private whisky collection and tasting advisor",
    start_url: "/",
    display: "standalone",
    background_color: "#f3eadb",
    theme_color: "#5b391c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml"
      }
    ]
  };
}
