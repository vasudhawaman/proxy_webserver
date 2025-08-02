document.addEventListener('DOMContentLoaded', () => {
  const proxyToggle = document.getElementById('proxy-toggle');
  const parserToggleBtn = document.getElementById('parser-toggle');
  const urlInput = document.getElementById('urlInput');
  const submitBtn = document.getElementById('submitUrl');
  const feedbackBtn = document.getElementById('get-feedback-btn');
  const feedbackListEl = document.getElementById('feedback-list');

  //Inserting the logo
  fetch('http://localhost:3000/logo')
    .then((response) => response.blob())
    .then((blob) => {
      const imgURL = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.src = imgURL;
      img.alt = 'Logo';
      img.style.width = '40px';
      document.getElementById('logo-image').appendChild(img);
    })
    .catch((error) => {
      console.error('Error fetching logo:', error);
    });

  // Initialize parser toggle state
  chrome.storage.local.get('isParserActive', ({ isParserActive }) => {
    parserToggleBtn.checked = isParserActive === true;
  });

  // On parser toggle change
  parserToggleBtn.addEventListener('change', async () => {
    const newParserState = parserToggleBtn.checked;
    await chrome.storage.local.set({ isParserActive: newParserState });

    try {
      const res = await fetch('http://localhost:3000/parser-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isParserActive: newParserState }),
      });

      if (res.ok) {
        console.log('Parser state sent to backend');
      } else {
        console.error('Failed to send parser state');
      }
    } catch (err) {
      console.error('Error sending parser state:', err);
    }
  });

  // Initialize proxy toggle state
  chrome.storage.local.get('isProxyActive', ({ isProxyActive }) => {
    proxyToggle.textContent = isProxyActive
      ? 'Deactivate Proxy'
      : 'Activate Proxy';
  });

  // Toggle proxy
  proxyToggle.addEventListener('click', async () => {
    const { isProxyActive } = await chrome.storage.local.get('isProxyActive');
    const newProxyState = !isProxyActive;

    await chrome.storage.local.set({ isProxyActive: newProxyState });
    proxyToggle.textContent = newProxyState
      ? 'Deactivate Proxy'
      : 'Activate Proxy';

    // Clear feedback if proxy is being deactivated
    if (!newProxyState) {
      try {
        const response = await fetch('http://localhost:3000/feedback', {
          method: 'DELETE',
        });

        if (response.ok) {
          feedbackListEl.innerHTML = '<li>No feedback yet</li>';
        } else {
          console.error('Failed to delete feedback:', response.statusText);
        }
      } catch (err) {
        console.error('Error sending DELETE request:', err);
      }
    }

    // Notify background
    chrome.runtime.sendMessage({
      type: 'TOGGLE_PROXY',
      active: newProxyState,
    });
  });

  // Submit URL to background
  submitBtn.addEventListener('click', () => {
    const inputUrl = urlInput.value.trim();
    if (!inputUrl) return;

    chrome.runtime.sendMessage({
      type: 'IPURL',
      url: inputUrl,
    });

    urlInput.value = '';
  });

  // Fetch feedback
  feedbackBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('http://localhost:3000/feedback');
      const feedbackList = await response.json();

      feedbackListEl.innerHTML = '';

      if (feedbackList.length === 0) {
        feedbackListEl.innerHTML = '<li>No feedback yet</li>';
        return;
      }

      feedbackList.forEach(({ url, status }) => {
        const li = document.createElement('li');
        li.style.marginLeft = '20px';

        li.innerHTML = `
    <span class="url" style="font-size: 17px;">${url}</span>&nbsp;&nbsp;&nbsp;->&nbsp;&nbsp;&nbsp;<span class="status" style="font-size: 17px;">${status}</span>
  `;

        const statusSpan = li.querySelector('.status');
        const urlSpan = li.querySelector('.url');
        statusSpan.style.color = status === 'safe' ? 'greenyellow' : 'red';
        // urlSpan.style.color = status === "safe" ? "greenyellow" : "red";

        feedbackListEl.appendChild(li);
      });
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    }
  });
});
