import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';
import { getRegistry, handleMessage } from './orchestrator';
import {
  AppealAgent,
  DistractionClassifierAgent,
  EchoAgent,
  EnforcementAgent,
  SenseAgent,
  SummarizeTitleAgent,
  PolicyAgent,
} from './agents';
import { enableStrictMode, getSettings, isSettingsLocked, updateSettings } from './settings';
import {
  addTemporaryAllow,
  clearAppealSession,
  getHostnameFromUrl,
  initAlarmHandlers,
  validateAppealSession,
  initSuspendPersistence,
} from './state';

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

// Register agents once on startup
try {
  const registry = getRegistry();
  registry.register(new EchoAgent());
  registry.register(new SummarizeTitleAgent());
  registry.register(new SenseAgent());
  registry.register(new DistractionClassifierAgent());
  registry.register(new PolicyAgent());
  registry.register(new EnforcementAgent());
  registry.register(new AppealAgent());
} catch {
  // ignore
}
initAlarmHandlers();
initSuspendPersistence();

type CurrentDOMDataType = {
  url: string;
  title: string;
  content: string;
  timestamp: number;
};

let currentDOMData: CurrentDOMDataType = {
  url: '',
  title: '',
  content: '',
  timestamp: 0,
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const sendMessageToTabWithRetry = async (tabId: number, message: unknown, attempts = 5): Promise<boolean> => {
  for (let i = 0; i < attempts; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, () => {
          const err = chrome.runtime.lastError?.message;
          if (err) {
            reject(new Error(err));
            return;
          }
          resolve();
        });
      });
      return true;
    } catch {
      if (i === attempts - 1) return false;
      await delay(150 * (i + 1));
    }
  }
  return false;
};

// Orchestrator drives all decisions; legacy classifier removed

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Agent invocation path (typed handler)
  if (
    message &&
    typeof message === 'object' &&
    'type' in message &&
    (message as { type: string }).type === 'agent:invoke'
  ) {
    void (async () => {
      const res = await handleMessage(message as { type: 'agent:invoke'; payload: { agent: string; input: unknown } }, {
        tabId: sender.tab?.id,
        env: process.env.NODE_ENV === 'development' ? 'development' : 'production',
      });
      if (res) {
        sendResponse(res);
      }
    })();
    return true; // keep the message channel open for async response
  }
  // fall through for existing handlers
  // Handle DOM capture (sync ack)
  if (message.type === 'DOM_CAPTURED') {
    currentDOMData = message.payload as CurrentDOMDataType;
    console.log('DOM captured from:', currentDOMData.url);

    if (sender.tab && sender.tab.id) {
      void handleMessage(message, {
        tabId: sender.tab.id,
        env: process.env.NODE_ENV === 'development' ? 'development' : 'production',
      });
    }

    chrome.storage.local.set({ domData: currentDOMData });
    // Acknowledge to avoid async-response error when the listener doesn't need to be async
    sendResponse({ ok: true });
    return; // no async response expected
  }

  // Handle requests for DOM data (sync)
  if (message.type === 'GET_DOM_DATA') {
    sendResponse(currentDOMData);
    return;
  }

  // Evaluate appeal from the chatbot UI (async)
  if (message.type === 'EVALUATE_APPEAL') {
    const conversation = message.payload.conversation as { role: 'user' | 'assistant'; content: string }[];
    const url = message.payload.url as string;
    const title = message.payload.title as string;
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ assistant: 'Invalid request.', allow: false, minutes: 0 });
      return true;
    }
    const hostname = getHostnameFromUrl(url);
    if (!hostname || !validateAppealSession(tabId, hostname)) {
      sendResponse({ assistant: 'Session invalid. Reload and try again.', allow: false, minutes: 0 });
      return true;
    }
    void (async () => {
      const res = (await getRegistry().invoke(
        'appeal',
        { tabId, env: process.env.NODE_ENV === 'development' ? 'development' : 'production' },
        { type: 'evaluate', payload: { conversation, context: { url, title } } },
      )) as { ok: boolean; data?: { assistant: string; allow: boolean; minutes: number } };
      if (res?.ok && res.data) sendResponse(res.data);
      else sendResponse({ assistant: 'Error evaluating appeal.', allow: false, minutes: 0 });
    })();
    return true; // async response will be sent
  }

  // Whitelisting is background-controlled only after a successful allow decision (sync)
  if (message.type === 'APPEAL_ALLOW') {
    const { url, minutes } = message.payload as { url: string; minutes: number };
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false });
      return; // sync
    }
    const hostname = getHostnameFromUrl(url);
    if (!hostname || !validateAppealSession(tabId, hostname)) {
      sendResponse({ ok: false });
      return; // sync
    }
    addTemporaryAllow(hostname, minutes || 20);
    clearAppealSession(tabId);
    // Tell content UI to close modal
    if (sender.tab?.id) {
      void sendMessageToTabWithRetry(sender.tab.id, { type: 'CLOSE_BLOCK_MODAL' });
    }
    sendResponse({ ok: true, hostname });
    return; // sync
  }

  // Options page messaging
  if (message.type === 'GET_SETTINGS') {
    getSettings()
      .then(res => sendResponse(res))
      .catch(() => sendResponse(null));
    return true;
  }
  if (message.type === 'UPDATE_SETTINGS') {
    updateSettings(async prev => ({ ...prev, ...(message.payload ?? {}) }))
      .then(next => sendResponse({ ok: true, settings: next }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message.type === 'ENABLE_STRICT') {
    const { days, hours } = message.payload as { days: number; hours: number };
    enableStrictMode(days, hours)
      .then(next => sendResponse({ ok: true, settings: next }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message.type === 'IS_LOCKED') {
    isSettingsLocked()
      .then(locked => sendResponse({ locked }))
      .catch(() => sendResponse({ locked: false }));
    return true;
  }

  // No async response
  return;
});

// Also listen for tab updates to capture DOM on page refresh or initial load
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    // The DOM is already captured by the content script, this is just an additional check
    console.log('Tab updated:', tab.url);
  }
});

// Inject history hooks into the main world so SPA navigations emit a custom event
chrome.webNavigation.onCommitted.addListener(details => {
  if (details.frameId !== 0) return;
  // Skip chrome:// and chrome-extension:// pages (cannot inject there)
  if (
    !details.url ||
    details.url.startsWith('chrome://') ||
    details.url.startsWith('chrome-extension://') ||
    details.url.startsWith('devtools://') ||
    details.url.startsWith('chrome-devtools://')
  )
    return;
  if (!chrome.scripting?.executeScript) return;

  try {
    void chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      world: 'MAIN',
      func: () => {
        try {
          // Avoid double-hooking
          const w = window as Window & { __spaiHistoryHooked?: boolean };
          if (w.__spaiHistoryHooked) return;
          w.__spaiHistoryHooked = true;

          const emit = () => window.dispatchEvent(new Event('spai:locationchange'));
          const originalPushState = history.pushState;
          const wrappedPushState: typeof history.pushState = function (
            this: History,
            ...args: Parameters<History['pushState']>
          ) {
            originalPushState.apply(this, args);
            emit();
          };
          history.pushState = wrappedPushState;
          const originalReplaceState = history.replaceState;
          const wrappedReplaceState: typeof history.replaceState = function (
            this: History,
            ...args: Parameters<History['replaceState']>
          ) {
            originalReplaceState.apply(this, args);
            emit();
          };
          history.replaceState = wrappedReplaceState;
          window.addEventListener('popstate', emit);
          window.addEventListener('hashchange', emit);
        } catch {
          // no-op
        }
      },
    });
  } catch {
    // Best-effort; ignore
  }
});
