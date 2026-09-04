import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { ConfigProvider } from "@/components/ConfigProvider";
import { publicConfig } from "@/lib/public-config";
import "./globals.css";

// Public URLs and capabilities come from protected runtime configuration.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "True Canadian Maps Studio", template: "%s · True Canadian Maps" },
  description: "Style, mark up, publish and embed interactive maps.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA">
      <head><Script src="/navigation-guard.js" strategy="beforeInteractive" /></head>
      <body>
        <ConfigProvider config={publicConfig()}>{children}</ConfigProvider>
      </body>
    </html>
  );
}
