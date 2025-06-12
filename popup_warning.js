// popup_warning.js
document.addEventListener('DOMContentLoaded', () => {
    const warningMessage = document.getElementById('warning-message');
    const continueBtn = document.getElementById('continue-btn');
    const exitBtn = document.getElementById('exit-btn');
  
    // Get the unsafe URL and reason from the background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'showWarning') {
        warningMessage.textContent = `The website ${request.url} may be unsafe. Reason: ${request.reason}`;
      }
    });
  
    // Handle "Continue Anyway" button click
    continueBtn.addEventListener('click', () => {
      window.close(); // Close the popup
    });
  
    // Handle "Exit" button click
    exitBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.remove(tabs[0].id); // Close the current tab
        window.close(); // Close the popup
      });
    });
  });