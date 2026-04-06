"use client";

const DB_NAME = "pos-product-cache";
const DB_VERSION = 1;

interface CachedData {
  key: string;
  data: unknown;
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("cache")) {
        db.createObjectStore("cache", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function setCacheData(key: string, data: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cache", "readwrite");
    tx.objectStore("cache").put({ key, data, updatedAt: Date.now() } as CachedData);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCacheData<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cache", "readonly");
    const request = tx.objectStore("cache").get(key);
    request.onsuccess = () => {
      const result = request.result as CachedData | undefined;
      resolve(result ? (result.data as T) : null);
    };
    request.onerror = () => reject(request.error);
  });
}
