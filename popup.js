// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const resultDiv = document.getElementById('result');
  const loadingDiv = document.getElementById('loading');
  const errorDiv = document.getElementById('error');
  const statusBox = document.getElementById('status-box');
  const statusMessage = document.getElementById('status-message');
  const reasonDiv = document.getElementById('reason');
  const userModifiedDiv = document.getElementById('user-modified');
  const currentUrlDiv = document.getElementById('current-url');

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      throw new Error('No active tab found');
    }

    // Display current URL
    currentUrlDiv.textContent = tab.url;

    // Check URL safety
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'checkURL', url: tab.url },
        resolve
      );
    });

    // Update UI based on result
    updateUI(result);

    // Setup feedback buttons
    setupFeedbackButtons(tab.url);

  } catch (error) {
    showError(error.message);
  }

  // Load saved sessions
  loadSavedSessions();

  // Handle save session button click
  document.getElementById('save-session').addEventListener('click', async () => {
    const sessionName = prompt('Enter a name for this session:');
    if (!sessionName) return;

    const tabs = await chrome.tabs.query({});
    const tabData = tabs.map(tab => ({
      url: tab.url,
      title: tab.title
    }));

    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'saveSession', sessionName, tabs: tabData },
        resolve
      );
    });

    if (result.success) {
      alert('Session saved successfully!');
      loadSavedSessions();
    } else {
      alert('Failed to save session: ' + (result.error || 'Unknown error'));
    }
  });
});

// Function to load saved sessions
function loadSavedSessions() {
  chrome.runtime.sendMessage({ action: 'getSessions' }, (sessions) => {
    const sessionsList = document.getElementById('saved-sessions');
    sessionsList.innerHTML = '';

    for (const [name, data] of Object.entries(sessions)) {
      const sessionDiv = document.createElement('div');
      sessionDiv.className = 'session-item';

      const sessionInfo = document.createElement('div');
      sessionInfo.className = 'session-info';
      sessionInfo.innerHTML = `
        <strong>${name}</strong>
        <br>
        <small>${data.tabs.length} tabs - ${new Date(data.timestamp).toLocaleString()}</small>
      `;

      const sessionActions = document.createElement('div');
      sessionActions.className = 'session-actions';

      const restoreButton = document.createElement('button');
      restoreButton.className = 'restore-btn';
      restoreButton.textContent = 'Restore';
      restoreButton.onclick = () => restoreSession(name);

      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-btn';
      deleteButton.textContent = 'Delete';
      deleteButton.onclick = () => deleteSession(name);

      sessionActions.appendChild(restoreButton);
      sessionActions.appendChild(deleteButton);

      sessionDiv.appendChild(sessionInfo);
      sessionDiv.appendChild(sessionActions);

      sessionsList.appendChild(sessionDiv);
    }
  });
}

// Function to restore a session
function restoreSession(sessionName) {
  chrome.runtime.sendMessage({ action: 'restoreSession', sessionName }, (response) => {
    if (!response.success) {
      alert('Failed to restore session: ' + (response.error || 'Unknown error'));
    }
  });
}

// Function to delete a session
function deleteSession(sessionName) {
  if (confirm(`Are you sure you want to delete the session "${sessionName}"?`)) {
    chrome.storage.local.get('savedSessions', (data) => {
      const sessions = data.savedSessions || {};
      delete sessions[sessionName];
      chrome.storage.local.set({ savedSessions: sessions }, () => {
        loadSavedSessions();
      });
    });
  }
}

// Function to update UI based on URL safety result
function updateUI(result) {
  const resultDiv = document.getElementById('result');
  const loadingDiv = document.getElementById('loading');
  const statusBox = document.getElementById('status-box');
  const statusMessage = document.getElementById('status-message');
  const reasonDiv = document.getElementById('reason');
  const userModifiedDiv = document.getElementById('user-modified');

  // Hide loading, show result
  loadingDiv.style.display = 'none';
  resultDiv.style.display = 'block';

  // Update status box class and message
  statusBox.className = 'status-box ' + (result.safe ? 'safe' : 'unsafe');
  statusMessage.textContent = result.safe ? 
    '✅ This URL appears to be safe' : 
    '⚠️ This URL may be unsafe';

  // Show reason if available
  if (result.reason) {
    reasonDiv.textContent = result.reason;
    reasonDiv.style.display = 'block';
  } else {
    reasonDiv.style.display = 'none';
  }

  // Show user modification status if applicable
  if (result.userModified) {
    userModifiedDiv.textContent = 'Based on user feedback';
    userModifiedDiv.style.display = 'block';
  } else {
    userModifiedDiv.style.display = 'none';
  }
}

// Function to show error message
function showError(message) {
  const loadingDiv = document.getElementById('loading');
  const resultDiv = document.getElementById('result');
  const errorDiv = document.getElementById('error');
  const errorMessage = document.getElementById('error-message');

  loadingDiv.style.display = 'none';
  resultDiv.style.display = 'none';
  errorDiv.style.display = 'block';
  errorMessage.textContent = `Error: ${message}`;
}

// Function to setup feedback buttons
function setupFeedbackButtons(url) {
  const markSafeBtn = document.getElementById('markSafe');
  const markUnsafeBtn = document.getElementById('markUnsafe');

  markSafeBtn.onclick = async () => {
    await updateFeedback(url, true);
    window.close(); // Close popup after feedback
  };

  markUnsafeBtn.onclick = async () => {
    await updateFeedback(url, false);
    window.close(); // Close popup after feedback
  };
}

// Function to update user feedback
async function updateFeedback(url, isSafe) {
  try {
    // Show loading state
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);

    // Send feedback
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { 
          action: 'updateFeedback', 
          url: url, 
          isSafe: isSafe 
        },
        resolve
      );
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to update feedback');
    }

    // Optional: Show success message briefly before closing
    const statusBox = document.getElementById('status-box');
    statusBox.className = 'status-box safe';
    statusBox.textContent = 'Feedback recorded. Thank you!';

  } catch (error) {
    showError(error.message);
  }
}