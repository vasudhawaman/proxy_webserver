const toggleBtn = document.getElementById('toggleBtn');
const submitBtn = document.getElementById('submitUrl');
const urlInput = document.getElementById('urlInput');

// Set initial toggle button state
chrome.storage.local.get('isProxyActive', ({ isProxyActive }) => {
  toggleBtn.textContent = isProxyActive ? 'Deactivate Proxy' : 'Activate Proxy';
});

// Toggle proxy button logic
toggleBtn.addEventListener('click', async () => {
  const { isProxyActive } = await chrome.storage.local.get('isProxyActive');
  const newState = !isProxyActive;

  await chrome.storage.local.set({ isProxyActive: newState });
  toggleBtn.textContent = newState ? 'Deactivate Proxy' : 'Activate Proxy';

  if (toggleBtn.textContent === 'Activate Proxy') {
    try {
      const response = await fetch('http://localhost:3000/api/feedback', {
        method: 'DELETE',
      });

      if (response.ok) {
        document.getElementById('feedback-list').innerHTML =
          '<li>No feedback yet</li>';
      } else {
        console.error('Failed to delete feedback:', response.statusText);
      }
    } catch (err) {
      console.error('Error sending DELETE request:', err);
    }
  }

  chrome.runtime.sendMessage({
    type: 'TOGGLE_PROXY',
    active: newState,
  });
});

// Submit custom URL logic
submitBtn.addEventListener('click', () => {
  const inputUrl = urlInput.value.trim();
  if (!inputUrl) return;

  // Send message to background to handle IPURL submission
  chrome.runtime.sendMessage({
    type: 'IPURL',
    url: inputUrl,
  });

  urlInput.value = ''; // optional: clear input after submit
});

document
  .getElementById('get-feedback-btn')
  .addEventListener('click', async () => {
    try {
      const response = await fetch('http://localhost:3000/api/feedback');
      const feedbackList = await response.json();

      const ul = document.getElementById('feedback-list');
      ul.innerHTML = '';

      if (feedbackList.length === 0) {
        ul.innerHTML = '<li>No feedback yet</li>';
        return;
      }

      feedbackList.forEach(({ url, status }) => {
        const li = document.createElement('li');
        li.textContent = `${url} ${status}`;
        ul.appendChild(li);
      });
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    }
  });
