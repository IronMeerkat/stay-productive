// Ephemeral background state: temporary allows and appeal sessions

type AppealSession = {
  tabId: number;
  hostname: string;
  createdAt: number;
};

const appealAllowMap: Map<string, number> = new Map(); // host -> expiry ts
const allowExpiryTimeouts: Map<string, number> = new Map();
const appealSessionsByTab: Map<number, AppealSession> = new Map();

export const getHostnameFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

export const isTemporarilyAllowed = (hostname: string): boolean => {
  const expiry = appealAllowMap.get(hostname);
  if (!expiry) return false;
  if (expiry > Date.now()) return true;
  appealAllowMap.delete(hostname);
  return false;
};

const scheduleAllowExpiry = (hostname: string, expiresAt: number): void => {
  const delay = Math.max(0, expiresAt - Date.now());
  const existing = allowExpiryTimeouts.get(hostname);
  if (existing) {
    clearTimeout(existing);
    allowExpiryTimeouts.delete(hostname);
  }
  if (chrome?.alarms?.create) {
    chrome.alarms.create(`allow:${hostname}`, { when: expiresAt });
    return;
  }
  const timeoutId = setTimeout(() => {
    appealAllowMap.delete(hostname);
    allowExpiryTimeouts.delete(hostname);
    void recaptureAllTabsForHost(hostname);
  }, delay) as unknown as number;
  allowExpiryTimeouts.set(hostname, timeoutId);
};

export const addTemporaryAllow = (hostname: string, minutes: number): void => {
  const ms = Math.max(1, minutes) * 60_000;
  const expiresAt = Date.now() + ms;
  appealAllowMap.set(hostname, expiresAt);
  scheduleAllowExpiry(hostname, expiresAt);
};

export const initAlarmHandlers = (): void => {
  if (chrome?.alarms?.onAlarm) {
    chrome.alarms.onAlarm.addListener(alarm => {
      if (alarm.name.startsWith('allow:')) {
        const hostname = alarm.name.slice('allow:'.length);
        appealAllowMap.delete(hostname);
        void recaptureAllTabsForHost(hostname);
      }
    });
  }
};

export const recaptureAllTabsForHost = async (hostname: string): Promise<void> => {
  try {
    chrome.tabs.query({}, tabs => {
      for (const t of tabs) {
        const url = t.url || '';
        try {
          const h = getHostnameFromUrl(url);
          if (h && h === hostname && t.id) {
            chrome.tabs.sendMessage(t.id, { type: 'REQUEST_DOM_CAPTURE' });
          }
        } catch {
          // ignore
        }
      }
    });
  } catch {
    // ignore
  }
};

export const createAppealSession = (tabId: number, hostname: string): void => {
  appealSessionsByTab.set(tabId, { tabId, hostname, createdAt: Date.now() });
};

export const validateAppealSession = (tabId: number, hostname: string): boolean => {
  const session = appealSessionsByTab.get(tabId);
  if (!session) return false;
  return session.hostname === hostname;
};

export const clearAppealSession = (tabId: number): void => {
  appealSessionsByTab.delete(tabId);
};

// Persist ephemeral state to chrome.storage.session on suspend
export const initSuspendPersistence = (): void => {
  try {
    chrome.runtime.onSuspend?.addListener(() => {
      const sessions: AppealSession[] = Array.from(appealSessionsByTab.values());
      const allows = Array.from(appealAllowMap.entries());
      void chrome.storage.session.set({ __appealSessions: sessions, __appealAllows: allows });
    });
    void (async () => {
      const obj = await chrome.storage.session.get(['__appealSessions', '__appealAllows']);
      const sessions = (obj.__appealSessions as AppealSession[] | undefined) ?? [];
      for (const s of sessions) appealSessionsByTab.set(s.tabId, s);
      const allows = (obj.__appealAllows as [string, number][] | undefined) ?? [];
      for (const [host, ts] of allows) appealAllowMap.set(host, ts);
    })();
  } catch {
    // ignore
  }
};
