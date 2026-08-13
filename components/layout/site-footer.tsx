import Link from "next/link";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-medium text-foreground">{SITE.name}</span>
          {" · "}
          {SITE.educationNotice}
        </p>
        <p>
          Developed by{" "}
          <Link
            href={SITE.developer.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-500 hover:underline"
          >
            {SITE.developer.label}
          </Link>
          {" · "}
          <span className="text-foreground/80">{SITE.domain}</span>
        </p>
      </div>
    </footer>
  );
}
