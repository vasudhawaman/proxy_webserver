const proxyToggle = document.getElementById('proxy-toggle');
const parserToggleBtn = document.getElementById('parser-toggle');
const urlInput = document.getElementById('urlInput');
const submitBtn = document.getElementById('submitUrl');

// Set initial parser toggle state
chrome.storage.local.get('isParserActive', ({ isParserActive }) => {
  parserToggleBtn.checked = isParserActive === true;
});

parserToggleBtn.addEventListener('change', async () => {
  const newParserState = parserToggleBtn.checked;
  await chrome.storage.local.set({ isParserActive: newParserState });
  fetch('http://localhost:3000/parser-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isParserActive: newParserState }),
  })
    .then((res) =>
      res.ok
        ? console.log('Parser state sent to backend')
        : console.error('Failed to send parser state')
    )
    .catch((err) => console.error('Error sending parser state:', err));
});

// Set initial toggle button state
chrome.storage.local.get('isProxyActive', ({ isProxyActive }) => {
  proxyToggle.textContent = isProxyActive
    ? 'Deactivate Proxy'
    : 'Activate Proxy';
});

proxyToggle.addEventListener('click', async () => {
  const { isProxyActive } = await chrome.storage.local.get('isProxyActive');
  const newProxyState = !isProxyActive;

  await chrome.storage.local.set({ isProxyActive: newProxyState });
  proxyToggle.textContent = newProxyState
    ? 'Deactivate Proxy'
    : 'Activate Proxy';

  if (proxyToggle.textContent === 'Activate Proxy') {
    try {
      const response = await fetch('http://localhost:3000/feedback', {
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
    active: newProxyState,
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

  urlInput.value = ''; // clear input after submit
});

document
  .getElementById('get-feedback-btn')
  .addEventListener('click', async () => {
    try {
      const response = await fetch('http://localhost:3000/feedback');
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
