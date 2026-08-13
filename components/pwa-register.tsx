"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { SITE } from "@/lib/site";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRegister() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // ignore registration failures in local http
      });
    }

    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

    if (isStandalone) return;

    if (isIos) {
      const dismissed = window.localStorage.getItem("pstv_ios_install_dismissed");
      if (!dismissed) setIosHint(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible && !iosHint) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg rounded-xl border border-teal-500/30 bg-[#0b1218]/95 p-3 shadow-xl backdrop-blur-md sm:inset-x-auto sm:right-4 sm:bottom-4 sm:left-auto">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
          <Download className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">
            Install {SITE.name} on this device
          </p>
          <p className="mt-0.5 text-xs text-white/65">
            {iosHint
              ? "On iPhone/iPad: Share → Add to Home Screen."
              : "Works as an app on Android, Windows, and Chromebook."}{" "}
            Education-only project by {SITE.developer.label}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {deferred && (
              <Button
                size="sm"
                className="bg-teal-600 text-white hover:bg-teal-500"
                onClick={async () => {
                  await deferred.prompt();
                  await deferred.userChoice;
                  setVisible(false);
                  setDeferred(null);
                }}
              >
                Install app
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setVisible(false);
                setIosHint(false);
                try {
                  window.localStorage.setItem("pstv_ios_install_dismissed", "1");
                } catch {
                  // ignore
                }
              }}
            >
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white"
          onClick={() => {
            setVisible(false);
            setIosHint(false);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
