const toggleBtn = document.getElementById("toggleBtn");

// Optional: toggle between test mode and full mode
const testOnly = true; // ← Set to false to proxy all http:// traffic

chrome.storage.local.get("isProxyActive", ({ isProxyActive }) => {
  toggleBtn.textContent = isProxyActive ? "Deactivate Proxy" : "Activate Proxy";
});

toggleBtn.addEventListener("click", async () => {
  const { isProxyActive } = await chrome.storage.local.get("isProxyActive");
  const newState = !isProxyActive;

  await chrome.storage.local.set({ isProxyActive: newState });
  toggleBtn.textContent = newState ? "Deactivate Proxy" : "Activate Proxy";

  // Send message with testOnly flag
  chrome.runtime.sendMessage({
    type: "TOGGLE_PROXY",
    active: newState,
    testOnly: testOnly, // 🔥 Pass this flag to background.js
  });
});
