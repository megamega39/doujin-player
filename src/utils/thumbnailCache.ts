const cache = new Map<string, string>();

export function getCachedThumbnail(path: string): string | undefined {
  return cache.get(path);
}

export function setCachedThumbnail(path: string, dataUrl: string): void {
  cache.set(path, dataUrl);
}
