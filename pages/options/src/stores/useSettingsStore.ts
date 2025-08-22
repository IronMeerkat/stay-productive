import { create } from '../vendor/zustand';
import type { Settings } from '@extension/contracts';

type SettingsState = {
  settings: Settings | null;
  locked: boolean;
  loading: boolean;
};

type SettingsActions = {
  fetch: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
};

export const useSettingsStore = create<SettingsState & SettingsActions>(set => ({
  settings: null,
  locked: false,
  loading: false,
  fetch: async () => {
    set({ loading: true });
    const res = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }).catch(() => null);
    if (res) set({ settings: res.settings as Settings, locked: Boolean(res.locked) });
    set({ loading: false });
  },
  update: async (patch: Partial<Settings>) => {
    set({ loading: true });
    const res = await chrome.runtime
      .sendMessage({ type: 'UPDATE_SETTINGS', payload: patch })
      .catch(() => ({ ok: false }));
    if (res?.ok) set({ settings: res.settings as Settings });
    set({ loading: false });
  },
}));
