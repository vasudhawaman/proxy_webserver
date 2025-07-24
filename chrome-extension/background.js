// ========================== PRODUCTION PROXY LOGIC ==========================

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TOGGLE_PROXY') {
    if (message.active) {
      chrome.proxy.settings.set(
        {
          value: {
            mode: 'fixed_servers',
            rules: {
              singleProxy: {
                scheme: 'http',
                host: 'localhost',
                port: 3000,
              },
              bypassList: ['<local>'],
            },
          },
          scope: 'regular',
        },
        () => console.log('Proxy enabled')
      );
    } else {
      chrome.proxy.settings.clear({ scope: 'regular' }, () => {
        console.log('Proxy disabled');
      });
    }
  } else if (message.type === 'IPURL') {
    console.log('User-entered URL:', message.url);
    chrome.tabs.create({
      url: `http://localhost:3000/manual?url=${encodeURIComponent(
        message.url
      )}`,
    });
  }
});

// ========================== TESTING: PAC Script Proxy Logic for example.com ==========================

// chrome.runtime.onMessage.addListener((message) => {
//   if (message.type === 'TOGGLE_PROXY') {
//     const { active } = message;

//     if (active) {
//       chrome.proxy.settings.set(
//         {
//           value: {
//             mode: 'pac_script',
//             pacScript: {
//               data: `
//                 function FindProxyForURL(url, host) {
//                   if (host === "example.com" || host === "www.example.com" || host === 'httpbin.org') {
//                     return 'PROXY localhost:3000';
//                   }
//                   return "DIRECT";
//                 }
//               `,
//             },
//           },
//           scope: 'regular',
//         },
//         () => {
//           console.log('Proxy enabled for example.com only');
//         }
//       );
//     } else {
//       chrome.proxy.settings.clear({ scope: 'regular' }, () => {
//         console.log('Proxy disabled');
//       });
//     }
//   } else if (message.type === 'IPURL') {
//     console.log('User-entered URL:', message.url);
//     chrome.tabs.create({
//       url: `http://localhost:3000/manual?url=${encodeURIComponent(
//         message.url
//       )}`,
//     });
//   }
// });
