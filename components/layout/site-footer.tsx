import Link from "next/link";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{SITE.name}</span>
          {" · "}
          {SITE.educationNotice}
        </p>
        <p className="text-foreground/85">{SITE.channelThanks}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            System developed by{" "}
            <Link
              href={SITE.developer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-500 hover:underline"
            >
              {SITE.developer.name}
            </Link>
          </span>
          <span aria-hidden>·</span>
          <Link
            href={SITE.developer.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {SITE.developer.label}
          </Link>
          <span aria-hidden>·</span>
          <span>{SITE.copyright}</span>
          <span aria-hidden>·</span>
          <span className="text-foreground/80">{SITE.domain}</span>
        </p>
      </div>
    </footer>
  );
}
