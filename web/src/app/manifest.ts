import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Stream-to-Clinic",
    short_name: "Stream2Clinic",
    description: "Report stream observations and see the health alerts they raise for nearby clinics.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0369a1",
    categories: ["health", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Report an observation", url: "/report", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Clinic alerts", url: "/clinic", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
