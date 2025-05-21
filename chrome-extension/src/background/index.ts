import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';
import { isDistraction } from '../services/openai';

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

// Current DOM data storage (in-memory)
let currentDOMData = {
  url: '',
  title: '',
  content: '',
  timestamp: 0,
};

// Check if a URL is from Reddit or YouTube
const isRedditOrYouTube = (url: string): { isMatch: boolean; type: 'reddit' | 'youtube' | null } => {
  const redditRegex = /^https?:\/\/([a-z]+\.)?reddit\.com/i;
  const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/i;

  if (redditRegex.test(url)) {
    return { isMatch: true, type: 'reddit' };
  } else if (youtubeRegex.test(url)) {
    return { isMatch: true, type: 'youtube' };
  }

  return { isMatch: false, type: null };
};

// Process captured DOM to check if it's a distraction
const processCapturedDOM = async (data: typeof currentDOMData, tabId: number) => {
  const { url, title } = data;
  const { isMatch, type } = isRedditOrYouTube(url);

  if (isMatch) {
    console.log(`Detected ${type} site: ${url}`);

    let contentToCheck = title;
    let isDistractionSite = false;

    if (type === 'reddit') {
      // Extract subreddit name from URL if possible
      const match = url.match(/\/r\/([^/]+)/i);
      if (match && match[1]) {
        contentToCheck = `r/${match[1]} - ${title}`;
      }

      isDistractionSite = await isDistraction(contentToCheck);
    } else if (type === 'youtube') {
      // For YouTube, check the video title
      isDistractionSite = await isDistraction(title);
    }

    if (isDistractionSite) {
      console.log(`${type} site is a distraction, redirecting to Google`);
      chrome.tabs.update(tabId, { url: 'https://www.google.com' });
    } else {
      console.log(`${type} site is not a distraction`);
    }
  }
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOM_CAPTURED') {
    // Store the DOM content
    currentDOMData = message.payload;
    console.log('DOM captured from:', message.payload.url);

    // Process the DOM to check if it's a distraction
    if (sender.tab && sender.tab.id) {
      processCapturedDOM(currentDOMData, sender.tab.id);
    }

    // Notify any open devtools panels
    // chrome.runtime.sendMessage({
    //   type: 'DOM_UPDATED',
    //   payload: currentDOMData,
    // });

    // Save to local storage as well
    chrome.storage.local.set({ domData: currentDOMData });
  }

  // Handle requests for DOM data
  if (message.type === 'GET_DOM_DATA') {
    sendResponse(currentDOMData);
  }

  return true; // Required for async response
});

// Also listen for tab updates to capture DOM on page refresh or initial load
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    // The DOM is already captured by the content script, this is just an additional check
    console.log('Tab updated:', tab.url);
  }
});
