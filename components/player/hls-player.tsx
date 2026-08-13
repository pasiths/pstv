"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { proxiedStreamUrl } from "@/lib/utils";

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

type HlsPlayerProps = {
  src: string;
  title?: string;
  pip?: boolean;
  useProxy?: boolean;
};

export function HlsPlayer({
  src,
  title,
  pip = false,
  useProxy = true,
}: HlsPlayerProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playSrc = useProxy ? proxiedStreamUrl(src) : src;

  useEffect(() => {
    setReady(false);
    setError(null);
  }, [playSrc]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-black shadow-lg">
      {!ready && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-teal-400" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 px-6 text-center text-sm text-red-300">
          {error}
        </div>
      )}
      <ReactPlayer
        key={playSrc}
        src={playSrc}
        playing
        controls
        width="100%"
        height="100%"
        pip={pip}
        playsInline
        muted={false}
        style={{ position: "absolute", inset: 0 }}
        onReady={() => setReady(true)}
        onError={() =>
          setError(
            `Unable to play${title ? ` ${title}` : ""}. The stream may be offline or blocked.`,
          )
        }
      />
    </div>
  );
}
