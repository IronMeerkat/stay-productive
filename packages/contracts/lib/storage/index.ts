export type StorageKey = 'settings' | 'domData' | 'tokens';

export interface KeyValueStorage<TValue> {
  get(key: StorageKey): Promise<TValue | null>;
  set(key: StorageKey, value: TValue): Promise<void>;
  remove(key: StorageKey): Promise<void>;
}
