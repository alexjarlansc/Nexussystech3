export const StorageKeys = {
  adminHash: 'nx_admin_hash',
  company: 'nx_company',
  products: 'nx_products',
  clients: 'nx_clients',
  quotes: 'nx_quotes',
  orcCounter: 'nx_orc_counter',
  pedCounter: 'nx_ped_counter',
} as const;

export function getJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function setJSON<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getString(key: string, fallback = ''): string {
  const v = localStorage.getItem(key);
  return v ?? fallback;
}

export function setString(key: string, value: string) {
  localStorage.setItem(key, value);
}
