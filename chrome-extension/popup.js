const toggleBtn = document.getElementById("toggleBtn");
const submitBtn = document.getElementById("submitUrl");
const urlInput = document.getElementById("urlInput");

// Set initial toggle button state
chrome.storage.local.get("isProxyActive", ({ isProxyActive }) => {
  toggleBtn.textContent = isProxyActive ? "Deactivate Proxy" : "Activate Proxy";
});

// Toggle proxy button logic
toggleBtn.addEventListener("click", async () => {
  const { isProxyActive } = await chrome.storage.local.get("isProxyActive");
  const newState = !isProxyActive;

  await chrome.storage.local.set({ isProxyActive: newState });
  toggleBtn.textContent = newState ? "Deactivate Proxy" : "Activate Proxy";

  chrome.runtime.sendMessage({
    type: "TOGGLE_PROXY",
    active: newState,
  });
});

// Submit custom URL logic
submitBtn.addEventListener("click", () => {
  const inputUrl = urlInput.value.trim();
  if (!inputUrl) return;

  // Send message to background to handle IPURL submission
  chrome.runtime.sendMessage({
    type: "IPURL",
    url: inputUrl,
  });

  urlInput.value = ""; // optional: clear input after submit
});
