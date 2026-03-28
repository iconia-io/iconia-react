import fs from 'fs';
import path from 'path';

const LOCK_FILE = '.iconia-lock.json';

type CollectionLock = {
  icons: Record<string, string>; // slug → fingerprint
};

type LockFile = {
  version: 1;
  collections: Record<string, CollectionLock>;
};

function lockPath(): string {
  return path.resolve(process.cwd(), LOCK_FILE);
}

export function readLock(): LockFile {
  try {
    const raw = fs.readFileSync(lockPath(), 'utf-8');
    return JSON.parse(raw) as LockFile;
  } catch {
    return { version: 1, collections: {} };
  }
}

export function writeLock(lock: LockFile): void {
  fs.writeFileSync(lockPath(), JSON.stringify(lock, null, 2), 'utf-8');
}

export function updateLockCollection(
  lock: LockFile,
  collectionSlug: string,
  icons: { slug: string; fingerprint: string }[],
): LockFile {
  return {
    ...lock,
    collections: {
      ...lock.collections,
      [collectionSlug]: {
        icons: Object.fromEntries(icons.map((i) => [i.slug, i.fingerprint])),
      },
    },
  };
}

export function removeLockCollection(lock: LockFile, collectionSlug: string): LockFile {
  const { [collectionSlug]: _removed, ...rest } = lock.collections;
  return { ...lock, collections: rest };
}
