// Service worker: responds to ping from the website so it can detect extension install
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ping") {
    sendResponse({ installed: true });
  }
});
