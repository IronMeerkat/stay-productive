import { sampleFunction } from '@src/sampleFunction';

console.log('content script loaded');

// Shows how to call a function defined in another module
sampleFunction();

// Capture the entire DOM when the page loads
const captureDOM = () => {
  const domContent = document.documentElement.outerHTML;

  // Send the DOM content to the background script
  chrome.runtime.sendMessage({
    type: 'DOM_CAPTURED',
    payload: {
      url: window.location.href,
      title: document.title,
      content: domContent,
      timestamp: Date.now(),
    },
  });

  console.log('DOM captured and sent to background script');
};

// Execute immediately on script load
captureDOM();

// Also listen for navigation events via History API
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

// Override pushState
history.pushState = (...args) => {
  originalPushState.apply(this, args);

  // After navigation, capture the DOM
  setTimeout(captureDOM, 500); // Small delay to ensure DOM is updated
};

// Override replaceState
history.replaceState = (...args) => {
  originalReplaceState.apply(this, args);

  // After navigation, capture the DOM
  setTimeout(captureDOM, 500); // Small delay to ensure DOM is updated
};

// Listen for popstate events (back/forward navigation)
window.addEventListener('popstate', () => {
  setTimeout(captureDOM, 500); // Small delay to ensure DOM is updated
});
