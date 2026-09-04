import type { ReactNode } from "react";
import { publicConfig } from "@/lib/public-config";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { sourceUrl, edition } = publicConfig();
  return (
    <main className="flex min-h-screen items-center justify-center bg-ice p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <img src="/assets/icon.svg" alt="" width={40} height={40} />
          <div>
            <p className="font-display text-lg font-bold text-navy">True Canadian Maps</p>
            <p className="text-xs text-muted">Studio</p>
          </div>
        </div>
        {children}
        <p className="text-center text-xs text-muted">Using the managed preview means agreeing to the <a href="https://truecanadianmaps.com/terms.html" className="underline">Preview terms</a>. Read our <a href="https://truecanadianmaps.com/privacy.html" className="underline">Privacy notice</a>.</p>
        {edition === "selfhosted" ? <p className="text-center text-xs text-muted">This installation is self-hosted. Its operator determines account and privacy policies.</p> : null}
        {sourceUrl ? <p className="text-center text-xs text-muted"><a className="underline" href={sourceUrl}>Download this version’s source · AGPL-3.0-only</a></p> : null}
        <noscript><p className="text-center text-sm">Enable JavaScript to use the account forms.</p></noscript>
      </div>
    </main>
  );
}
