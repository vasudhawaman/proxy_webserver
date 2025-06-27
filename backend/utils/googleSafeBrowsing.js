const https = require('https');
require('dotenv').config();

function useGoogleAPI(targetedURL) {
  const postData = JSON.stringify({
    client: {
      // our project's id and version on google db
      clientId: 'proxyServer-IITI',
      clientVersion: '1.0.0',
    },
    threatInfo: {
      threatTypes: [
        'MALWARE',
        'SOCIAL_ENGINEERING',
        'UNWANTED_SOFTWARE',
        'POTENTIALLY_HARMFUL_APPLICATION',
      ], //types of threat to check against
      platformTypes: ['WINDOWS'], //users platform
      threatEntryTypes: ['URL'],
      threatEntries: [{ url: targetedURL }],
    },
  });

  const options = {
    hostname: 'safebrowsing.googleapis.com',
    port: 443,
    path: `/v4/threatMatches:find?key=${process.env.GOOGLE_API_KEY}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  // Wrapping the API request in a Promise for async/await usage
  return new Promise((resolve, reject) => {
    const googleReq = https.request(options, (googleRes) => {
      let body = '';

      googleRes.on('data', (chunk) => (body += chunk));
      googleRes.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(Object.keys(result).length === 0); //google return empty object if url is safe
        } catch {
          reject(new Error('Failed to parse Google API response'));
        }
      });
    });

    googleReq.on('error', reject);
    googleReq.write(postData);
    googleReq.end();
  });
}

module.exports = { useGoogleAPI };
