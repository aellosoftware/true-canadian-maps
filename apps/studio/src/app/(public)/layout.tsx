import Link from "next/link";
import type { ReactNode } from "react";
import { publicConfig } from "@/lib/public-config";

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { sourceUrl } = publicConfig();
  return (
    <div className="min-h-screen bg-ice">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/gallery" className="flex items-center gap-2"><img src="/assets/logo.svg" alt="True Canadian Maps" height={28} className="h-7" /></Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-navy"><Link href="/gallery">Gallery</Link><Link href="/login" className="rounded-md bg-red px-3 py-1.5 text-white hover:bg-red-dark">Sign in</Link></nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted">Map data © OpenStreetMap contributors · Basemap tiles by Protomaps · Styles shared by their authors.{sourceUrl ? <a className="mt-2 block underline" href={sourceUrl}>Download this version’s source · AGPL-3.0-only</a> : null}</footer>
    </div>
  );
}
