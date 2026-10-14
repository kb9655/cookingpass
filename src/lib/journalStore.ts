export type JournalKind = "cook" | "practice";

export type JournalPhoto = {
  id: string;
  ownerId: string;
  kind: JournalKind;
  title: string;
  recipeId?: string;
  techniqueId?: string;
  sessionId: string;
  createdAt: number;
  blob: Blob;
};

const DB_NAME = "cookingpass-journal";
const STORE = "photos";

export function journalOwnerId(userId: string | null | undefined): string {
  return userId?.trim() || "guest";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("ownerId", "ownerId", { unique: false });
        store.createIndex("sessionId", "sessionId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export class JournalQuotaError extends Error {
  constructor() {
    super("quota");
    this.name = "JournalQuotaError";
  }
}

function rethrowQuota(err: unknown): never {
  if (err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22)) {
    throw new JournalQuotaError();
  }
  throw err instanceof Error ? err : new Error("IndexedDB failed");
}

export async function addJournalPhoto(
  input: Omit<JournalPhoto, "id" | "createdAt"> & { id?: string; createdAt?: number },
): Promise<JournalPhoto> {
  const row: JournalPhoto = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    createdAt: input.createdAt ?? Date.now(),
  };
  try {
    const db = await openDb();
    try {
      await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).add(row));
    } finally {
      db.close();
    }
  } catch (err) {
    rethrowQuota(err);
  }
  return row;
}

export async function listJournalPhotos(ownerId: string): Promise<JournalPhoto[]> {
  const db = await openDb();
  try {
    const index = db.transaction(STORE, "readonly").objectStore(STORE).index("ownerId");
    const rows = await requestToPromise(index.getAll(ownerId));
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    db.close();
  }
}

export type JournalGroup = {
  sessionId: string;
  title: string;
  kind: JournalKind;
  createdAt: number;
  photos: JournalPhoto[];
};

export function groupJournalPhotos(photos: JournalPhoto[]): JournalGroup[] {
  const map = new Map<string, JournalGroup>();
  for (const photo of photos) {
    const current = map.get(photo.sessionId);
    if (!current) {
      map.set(photo.sessionId, {
        sessionId: photo.sessionId,
        title: photo.title,
        kind: photo.kind,
        createdAt: photo.createdAt,
        photos: [photo],
      });
      continue;
    }
    current.photos.push(photo);
    current.createdAt = Math.max(current.createdAt, photo.createdAt);
  }
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
}
