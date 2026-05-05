// Open the side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Allow the side panel on zyphe.ai and localhost
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    enabled: true,
  });
});

// Relay messages between content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'IMAGES_FOUND') {
    // Forward to side panel — broadcast to all extension pages
    chrome.runtime.sendMessage(message).catch(() => {
      // Side panel might not be open yet; ignore
    });
  }
  sendResponse({ ok: true });
  return true;
});
