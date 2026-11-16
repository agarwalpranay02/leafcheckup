import type { MetadataRoute } from "next";
import { COVERAGE } from "@/lib/diseases";

// share_target is a valid Web App Manifest member that Next's type does not list yet
type Manifest = MetadataRoute.Manifest & { share_target?: unknown };

export default function manifest(): Manifest {
  return {
    id: "/",
    name: "LeafCheckup: crop disease diagnosis",
    short_name: "LeafCheckup",
    description: `Diagnose ${COVERAGE.crops} leaf diseases from a photo, offline and free.`,
    start_url: "/diagnose?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#f5f8f2",
    theme_color: "#1d4231",
    lang: "en-IN",
    categories: ["productivity", "utilities", "education"],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", files: [{ name: "image", accept: ["image/*"] }] },
    },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    // Lets Chrome and Android show a richer install dialog
    screenshots: [
      { src: "/screenshots/wide.jpg", sizes: "1440x900", type: "image/jpeg", form_factor: "wide", label: "Diagnose a leaf from one photo" },
      { src: "/screenshots/narrow.jpg", sizes: "780x1688", type: "image/jpeg", form_factor: "narrow", label: "LeafCheckup on a phone" },
    ],
    shortcuts: [
      { name: "Diagnose a leaf", url: "/diagnose?source=shortcut" },
      { name: "Batch scan", url: "/batch?source=shortcut" },
      { name: "My scans", url: "/history?source=shortcut" },
    ],
  };
}
