const toggleBtn = document.getElementById("toggleBtn");

chrome.storage.local.get("isProxyActive", ({ isProxyActive }) => {
  toggleBtn.textContent = isProxyActive ? "Deactivate Proxy" : "Activate Proxy";
});

toggleBtn.addEventListener("click", async () => {
  const { isProxyActive } = await chrome.storage.local.get("isProxyActive");
  const newState = !isProxyActive;

  await chrome.storage.local.set({ isProxyActive: newState });
  toggleBtn.textContent = newState ? "Deactivate Proxy" : "Activate Proxy";

  // Notify the background to update proxy settings
  // Send message to background.js
  chrome.runtime.sendMessage({ type: "TOGGLE_PROXY", active: newState });
});
