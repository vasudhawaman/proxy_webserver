// // Proxy is set to ON or OFF in this script and
// // it is different from updating proxy state in local storage that is done in popup.js

// // This listener responds to messages sent from other extension parts (like popup.js)
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   // Only respond to messages of type "TOGGLE_PROXY"
//   if (message.type === 'TOGGLE_PROXY') {
//     // If the new proxy state is active, enable the proxy
//     if (message.active) {
//       // Set Chrome's proxy settings
//       chrome.proxy.settings.set(
//         {
//           // value{...} => The actual proxy configuration
//           value: {
//             // Use a fixed, custom proxy server
//             mode: 'fixed_servers',

//             //rules{...} => Define the proxy rules
//             rules: {
//               // Our single proxy server config (Our proxy's address)
//               singleProxy: {
//                 scheme: 'http', // Protocol used by our proxy (can be "http", "https", or "socks")
//                 host: 'localhost', // Host of our proxy
//                 port: 3000, // Port our proxy listens on
//               },
//               // Domains or IPs that should bypass the proxy
//               bypassList: ['<local>'],
//             },
//           },

//           // Apply proxy to regular (non-incognito) browser sessions
//           scope: 'regular',
//         },

//         // Callback that runs after the proxy has been enabled
//         () => {
//           console.log('Proxy enabled');
//         }
//       );
//     }

//     //     // If the proxy state is inactive, disable the proxy
//     else {
//       // Clear Chrome's proxy settings (go back to direct connection)
//       chrome.proxy.settings.clear({ scope: 'regular' }, () => {
//         console.log('Proxy disabled');
//       });
//     }
//   }
// });

// for testing purposes works for only example.com (http/https)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_PROXY') {
    if (message.active) {
      // Enable proxy only for example.com
      chrome.proxy.settings.set(
        {
          value: {
            mode: 'pac_script',
            pacScript: {
              data: `
                function FindProxyForURL(url, host) {
                  if (host === "example.com" || host === "www.example.com") {
                    return "PROXY localhost:3000";
                  }
                  return "DIRECT";
                }
              `,
            },
          },
          scope: 'regular',
        },
        () => {
          console.log('Proxy enabled for example.com only');
        }
      );
    } else {
      // Disable proxy
      chrome.proxy.settings.clear({ scope: 'regular' }, () => {
        console.log('Proxy disabled');
      });
    }
  }
});


//////////////////*********************************************///////////////////////////
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle manual URL submission
  if (message.type === 'IPURL') {
  const url = message.url;
  console.log('User-entered URL:', url);

  // Open new tab with the rendered response page
  chrome.tabs.create({
    url: `http://localhost:3000/inspect?manual=1&url=${encodeURIComponent(url)}`
  });
}
});



