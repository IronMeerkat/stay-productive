import '@src/Panel.css';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import type { ComponentPropsWithoutRef } from 'react';
import { useEffect, useState } from 'react';

// Type definition for DOM data
interface DOMData {
  url: string;
  title: string;
  content: string;
  timestamp: number;
}

// Type for the message
interface DOMMessage {
  type: string;
  payload?: DOMData;
}

const Panel = () => {
  const theme = useStorage(exampleThemeStorage);
  const isLight = theme === 'light';
  const [domData, setDomData] = useState<DOMData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRawHTML, setShowRawHTML] = useState(false);

  // Function to fetch DOM data from background script
  const fetchDOMData = () => {
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'GET_DOM_DATA' }, response => {
      if (response && response.content) {
        setDomData(response);
      } else {
        console.log('No DOM data available yet');
      }
      setLoading(false);
    });
  };

  // Listen for DOM updates
  useEffect(() => {
    // Initial fetch
    fetchDOMData();

    // Listen for DOM update messages
    const handleMessage = (message: DOMMessage) => {
      if (message.type === 'DOM_UPDATED' && message.payload) {
        setDomData(message.payload);
        setLoading(false);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Cleanup
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className={`App ${isLight ? 'bg-slate-50' : 'bg-gray-800'}`}>
      <header className={`App-header ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
        <h1 className="text-2xl font-bold mb-4">DOM Inspector</h1>

        {loading ? (
          <div className="text-center">Loading DOM data...</div>
        ) : domData ? (
          <div className="w-full max-w-4xl">
            <div className="mb-4 p-4 border rounded bg-opacity-10 bg-gray-200">
              <h2 className="text-xl font-semibold mb-2">Page Info</h2>
              <p>
                <strong>URL:</strong> {domData.url}
              </p>
              <p>
                <strong>Title:</strong> {domData.title}
              </p>
              <p>
                <strong>Captured:</strong> {formatTime(domData.timestamp)}
              </p>
              <button
                onClick={() => setShowRawHTML(!showRawHTML)}
                className={`mt-4 py-1 px-4 rounded shadow hover:scale-105 ${
                  isLight ? 'bg-blue-500 text-white' : 'bg-blue-700 text-white'
                }`}>
                {showRawHTML ? 'Hide HTML' : 'Show HTML'}
              </button>
            </div>

            {showRawHTML && (
              <div className="mt-4 p-4 border rounded bg-opacity-10 bg-gray-200">
                <h2 className="text-xl font-semibold mb-2">HTML Content</h2>
                <div className="overflow-auto max-h-96 p-2 bg-opacity-20 bg-gray-200 rounded">
                  <pre className="text-xs whitespace-pre-wrap">{domData.content}</pre>
                </div>
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={fetchDOMData}
                className={`py-1 px-4 rounded shadow hover:scale-105 ${
                  isLight ? 'bg-green-500 text-white' : 'bg-green-700 text-white'
                }`}>
                Refresh DOM Data
              </button>
              <ToggleButton className="ml-2" onClick={exampleThemeStorage.toggle}>
                {t('toggleTheme')}
              </ToggleButton>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p>No DOM data available. Navigate to a webpage to capture DOM content.</p>
            <button
              onClick={fetchDOMData}
              className={`mt-4 py-1 px-4 rounded shadow hover:scale-105 ${
                isLight ? 'bg-green-500 text-white' : 'bg-green-700 text-white'
              }`}>
              Check Again
            </button>
          </div>
        )}
      </header>
    </div>
  );
};

const ToggleButton = (props: ComponentPropsWithoutRef<'button'>) => {
  const { isLight } = useStorage(exampleThemeStorage);

  return (
    <button
      className={
        props.className +
        ' ' +
        'font-bold py-1 px-4 rounded shadow hover:scale-105 ' +
        (theme === 'light' ? 'bg-white text-black' : 'bg-black text-white')
      }
      onClick={exampleThemeStorage.toggle}>
      {props.children}
    </button>
  );
};

export default withErrorBoundary(withSuspense(Panel, <LoadingSpinner />), ErrorDisplay);
