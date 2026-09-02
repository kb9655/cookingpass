import { useEffect, useState } from "react";
import { ImageOff, ImagePlus, Video } from "lucide-react";
import { resolveMediaUrl } from "../../lib/api";
import type { Media } from "../../types/media";

type Props = {
  media?: Pick<Media, "id" | "type" | "storage_path" | "source_url" | "author" | "license"> | null;
  label?: string;
  className?: string;
};

export function MediaSlot({ media, label = "학습 자료", className = "" }: Props) {
  const [url, setUrl] = useState<string | null>(media?.source_url ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setUrl(media?.source_url ?? null);
    if (!media) return;
    void resolveMediaUrl({
      mediaId: media.id,
      storagePath: media.storage_path,
      sourceUrl: media.source_url,
    }).then((resolved) => {
      if (active && resolved) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [media]);

  const attribution =
    media?.author || media?.license
      ? [media.author, media.license].filter(Boolean).join(" / ")
      : null;

  if (failed) {
    return (
      <div className={`media-slot ${className}`}>
        <ImageOff className="h-6 w-6" strokeWidth={1.75} />
        <p>미디어를 불러오지 못했습니다.</p>
      </div>
    );
  }

  if (url && media?.type === "video") {
    return (
      <figure className={className}>
        <video
          className="aspect-video w-full rounded-[1.25rem] bg-ink object-cover"
          controls
          src={url}
          onError={() => setFailed(true)}
        />
        {attribution ? <figcaption className="mt-2 text-xs text-muted">{attribution}</figcaption> : null}
      </figure>
    );
  }

  if (url) {
    return (
      <figure className={className}>
        <img
          src={url}
          alt={label}
          className="aspect-[4/3] w-full rounded-[1.25rem] object-cover"
          onError={() => setFailed(true)}
        />
        {attribution ? <figcaption className="mt-2 text-xs text-muted">{attribution}</figcaption> : null}
      </figure>
    );
  }

  return (
    <div className={`media-slot ${className}`}>
      {media?.type === "video" ? (
        <Video className="h-6 w-6" strokeWidth={1.75} />
      ) : (
        <ImagePlus className="h-6 w-6" strokeWidth={1.75} />
      )}
      <p>{media?.type === "video" ? "영상 준비 중" : "이미지 준비 중"}</p>
      <span>{label}</span>
    </div>
  );
}
