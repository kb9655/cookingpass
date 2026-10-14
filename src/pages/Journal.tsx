import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, PageLoader } from "../components/common/Feedback";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import {
  groupJournalPhotos,
  journalOwnerId,
  listJournalPhotos,
  type JournalPhoto,
} from "../lib/journalStore";
import { safeDownloadName, saveBlobToDevice, saveJournalPhotosZip } from "../lib/saveToDevice";

export function Journal() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const ownerId = journalOwnerId(user?.id);
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listJournalPhotos(ownerId)
      .then((rows) => {
        if (active) setPhotos(rows);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : t("journalLoadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ownerId, t]);

  const urls = useMemo(() => {
    const map = new Map<string, string>();
    for (const photo of photos) map.set(photo.id, URL.createObjectURL(photo.blob));
    return map;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, [urls]);

  const groups = useMemo(() => groupJournalPhotos(photos), [photos]);

  async function downloadOne(photo: JournalPhoto) {
    setBusy(photo.id);
    setError("");
    try {
      const stamp = new Date(photo.createdAt).toISOString().slice(0, 10);
      await saveBlobToDevice(photo.blob, `${safeDownloadName(photo.title, "photo")}-${stamp}.jpg`);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : t("journalDownloadError"));
      }
    } finally {
      setBusy("");
    }
  }

  async function downloadGroup(photosInGroup: JournalPhoto[], title: string, createdAt: number) {
    setBusy(photosInGroup[0]?.sessionId ?? "group");
    setError("");
    try {
      const stamp = new Date(createdAt).toISOString().slice(0, 10);
      await saveJournalPhotosZip(photosInGroup, `${safeDownloadName(title, "journal")}-${stamp}.zip`);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : t("journalDownloadError"));
      }
    } finally {
      setBusy("");
    }
  }

  async function downloadAll() {
    if (photos.length === 0) return;
    setBusy("all");
    setError("");
    try {
      await saveJournalPhotosZip(photos, "cookingpass-journal.zip");
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : t("journalDownloadError"));
      }
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="page">
      <h1 className="text-3xl font-black tracking-tight">{t("journalTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("journalLead")}</p>
      <p className="mt-2 text-sm text-muted">{t("journalLocalNote")}</p>

      {photos.length > 0 ? (
        <button
          className="btn-secondary mt-4 w-full"
          type="button"
          disabled={busy === "all"}
          onClick={() => void downloadAll()}
        >
          {t("journalDownloadAll")}
        </button>
      ) : null}

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6">
          <PageLoader label={t("pageLoading")} />
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={t("journalEmptyTitle")} body={t("journalEmptyBody")} />
        </div>
      ) : (
        <ul className="mt-6 space-y-5">
          {groups.map((group) => (
            <li key={group.sessionId} className="card-casual p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-accent">
                    {group.kind === "cook" ? t("journalCook") : t("journalPractice")}
                  </p>
                  <h2 className="mt-1 text-lg font-black break-keep">{group.title}</h2>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(group.createdAt).toLocaleString(locale === "en" ? "en-US" : "ko-KR")}
                  </p>
                </div>
                <button
                  className="btn-secondary shrink-0 px-3 text-xs"
                  type="button"
                  disabled={busy === group.sessionId}
                  onClick={() => void downloadGroup(group.photos, group.title, group.createdAt)}
                >
                  {t("journalDownloadGroup")}
                </button>
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-2 list-wide">
                {group.photos.map((photo) => (
                  <li key={photo.id} className="min-w-0">
                    <img
                      src={urls.get(photo.id)}
                      alt={photo.title}
                      className="aspect-[4/3] w-full rounded-[1.25rem] object-cover"
                    />
                    <button
                      className="btn-secondary mt-2 w-full px-3 text-xs"
                      type="button"
                      disabled={busy === photo.id}
                      onClick={() => void downloadOne(photo)}
                    >
                      {t("journalDownload")}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
