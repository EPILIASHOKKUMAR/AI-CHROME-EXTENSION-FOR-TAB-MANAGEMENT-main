// content.js
function extractContent() {
  let content = document.body.innerText;
  return content;
}

// Function to analyze content and apply color coding
function analyzeAndHighlightContent() {
  const bodyText = document.body.innerText;

  // Define keywords for harmful and useful content
  const harmfulKeywords = ['malware', 'phishing', 'scam', 'hack', 'virus', 'fraud'];
  const usefulKeywords = ['safe', 'secure', 'trusted', 'verified', 'official'];

  // Split the body text into words
  const words = bodyText.split(/\s+/);

  // Clear existing highlights
  document.body.innerHTML = document.body.innerHTML.replace(
    /<span class="harmful">|<\/span>|<span class="useful">|<\/span>/g,
    ''
  );

  // Highlight harmful and useful words
  words.forEach((word) => {
    const lowerWord = word.toLowerCase();
    if (harmfulKeywords.includes(lowerWord)) {
      document.body.innerHTML = document.body.innerHTML.replace(
        new RegExp(`\\b${word}\\b`, 'g'),
        `<span class="harmful">${word}</span>`
      );
    } else if (usefulKeywords.includes(lowerWord)) {
      document.body.innerHTML = document.body.innerHTML.replace(
        new RegExp(`\\b${word}\\b`, 'g'),
        `<span class="useful">${word}</span>`
      );
    }
  });
}

// Monitor for dynamic content changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' || mutation.type === 'characterData') {
      analyzeAndHighlightContent();
      chrome.runtime.sendMessage({ 
        action: 'extract', 
        content: extractContent(),
        url: window.location.href
      });
    }
  });
});

// Start observing document changes
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

// Send initial content
chrome.runtime.sendMessage({ 
  action: 'extract', 
  content: extractContent(),
  url: window.location.href
});

// Analyze and highlight content on page load
analyzeAndHighlightContent();

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'getPageContent') {
    const pageContent = document.body ? document.body.innerText : '';
    sendResponse({ pageContent });
  }
});