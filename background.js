// background.js
// Initialize storage on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    blacklistedDomains: [
      'example-malware.com',
      'phishing-example.net'
    ],
    whitelistedDomains: [],
    userFeedback: {},
    savedSessions: {} // Add savedSessions to store session data
  });

  // Request notification permission
  Notification.requestPermission();
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    checkAndNotify(tab.url, tabId);
  }
});

// Listen for navigation events
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) {  // Main frame only
    chrome.tabs.get(details.tabId, (tab) => {
      checkAndNotify(tab.url, tab.id);
    });
  }
});

// Helper function to extract domain from URL
function extractDomain(url) {
  try {
    const urlObject = new URL(url);
    return urlObject.hostname.toLowerCase();
  } catch (e) {
    console.error('Invalid URL:', e);
    return null;
  }
}

// Helper function to check if domain matches any pattern
function isDomainMatch(domain, patternList) {
  if (!domain) return false;
  return patternList.some(pattern => {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`).test(domain);
  });
}

// Function to show notification
function showNotification(result, url) {
  const notificationOptions = {
    type: 'basic',
    iconUrl: result.safe ? '/icons/icon48.png' : '/icons/warning48.png',
    title: result.safe ? 'Safe Website' : '⚠️ WARNING: Unsafe Website Detected',
    message: result.safe ? 'This website is safe.' : `This website may be unsafe. Reason: ${result.reason}`,
    priority: 2,
    silent: result.safe // Only play sound for unsafe websites
  };

  chrome.notifications.create('urlCheck_' + Date.now(), notificationOptions, (notificationId) => {
    // Add buttons for "Continue Anyway" and "Exit"
    if (!result.safe) {
      chrome.notifications.onButtonClicked.addListener((clickedNotificationId, buttonIndex) => {
        if (clickedNotificationId === notificationId) {
          if (buttonIndex === 0) {
            // "Continue Anyway" button clicked
            console.log('User chose to continue.');
          } else if (buttonIndex === 1) {
            // "Exit" button clicked
            chrome.tabs.remove(tabId); // Close the tab
          }
        }
      });

      // Update notification with buttons
      chrome.notifications.update(notificationId, {
        buttons: [
          { title: 'Continue Anyway' },
          { title: 'Exit' }
        ]
      });
    }
  });
}

// Main URL check function
async function checkUrlSafety(url) {
  const domain = extractDomain(url);
  if (!domain) return { safe: false, reason: 'Invalid URL' };

  const data = await chrome.storage.local.get([
    'blacklistedDomains',
    'whitelistedDomains',
    'userFeedback'
  ]);

  if (isDomainMatch(domain, data.whitelistedDomains)) {
    return {
      safe: true,
      reason: 'Domain is whitelisted',
      userModified: true
    };
  }

  if (isDomainMatch(domain, data.blacklistedDomains)) {
    return {
      safe: false,
      reason: 'Domain is blacklisted',
      userModified: true
    };
  }

  const domainFeedback = data.userFeedback[domain];
  if (domainFeedback) {
    return {
      safe: domainFeedback.safe,
      reason: 'Based on previous user feedback',
      userModified: true,
      feedbackCount: domainFeedback.count
    };
  }

  const securityIssues = [];
  
  const suspiciousTLDs = ['.xyz', '.tk', '.ml', '.ga', '.cf', '.spa'];
  if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
    securityIssues.push('Suspicious top-level domain');
  }

  if (domain.split('.').length > 3) {
    securityIssues.push('Unusually complex domain structure');
  }

  if (/\d{4,}/.test(domain)) {
    securityIssues.push('Contains suspicious number sequences');
  }

  return {
    safe: securityIssues.length === 0,
    reason: securityIssues.length ? securityIssues.join(', ') : 'No obvious security issues',
    userModified: false
  };
}

// Function to check URL and show notification/popup
async function checkAndNotify(url, tabId) {
  const result = await checkUrlSafety(url);

  // Show notification and popup only for unsafe websites
  if (!result.safe) {
    showNotification(result, url);
    chrome.action.setPopup({ tabId, popup: 'popup.html' }); // Open the popup
  }

  // Update icon based on safety
  const icon = result.safe ? '/icons/icon48.png' : '/icons/warning48.png';
  chrome.action.setIcon({ path: icon, tabId: tabId });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'checkURL':
      checkUrlSafety(request.url)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ 
          safe: false, 
          reason: 'Error checking URL: ' + error.message 
        }));
      return true;

    case 'updateFeedback':
      updateUserFeedback(request.url, request.isSafe)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ 
          success: false, 
          error: error.message 
        }));
      return true;

    case 'saveSession':
      saveSession(request.sessionName, request.tabs)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ 
          success: false, 
          error: error.message 
        }));
      return true;

    case 'getSessions':
      chrome.storage.local.get('savedSessions', (data) => {
        sendResponse(data.savedSessions || {});
      });
      return true;

    case 'restoreSession':
      restoreSession(request.sessionName)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ 
          success: false, 
          error: error.message 
        }));
      return true;
  }
});

// Function to update user feedback
async function updateUserFeedback(url, isSafe) {
  const domain = extractDomain(url);
  if (!domain) return { success: false, error: 'Invalid URL' };

  try {
    const data = await chrome.storage.local.get([
      'whitelistedDomains',
      'blacklistedDomains',
      'userFeedback'
    ]);

    if (isSafe) {
      data.whitelistedDomains = [...new Set([...data.whitelistedDomains, domain])];
      data.blacklistedDomains = data.blacklistedDomains.filter(d => d !== domain);
    } else {
      data.blacklistedDomains = [...new Set([...data.blacklistedDomains, domain])];
      data.whitelistedDomains = data.whitelistedDomains.filter(d => d !== domain);
    }

    data.userFeedback[domain] = {
      safe: isSafe,
      count: (data.userFeedback[domain]?.count || 0) + 1,
      lastUpdated: Date.now()
    };

    await chrome.storage.local.set(data);
    return { success: true };
  } catch (error) {
    console.error('Error updating feedback:', error);
    return { success: false, error: error.message };
  }
}

// Function to save a session
async function saveSession(sessionName, tabs) {
  try {
    const data = await chrome.storage.local.get('savedSessions');
    const savedSessions = data.savedSessions || {};

    savedSessions[sessionName] = {
      tabs: tabs,
      timestamp: Date.now()
    };

    await chrome.storage.local.set({ savedSessions });
    return { success: true };
  } catch (error) {
    console.error('Error saving session:', error);
    return { success: false, error: error.message };
  }
}

// Function to restore a session
async function restoreSession(sessionName) {
  try {
    const data = await chrome.storage.local.get('savedSessions');
    const session = data.savedSessions[sessionName];

    if (!session) {
      throw new Error('Session not found');
    }

    // Open all tabs in the session
    for (const tab of session.tabs) {
      await chrome.tabs.create({ url: tab.url });
    }

    return { success: true };
  } catch (error) {
    console.error('Error restoring session:', error);
    return { success: false, error: error.message };
  }
}