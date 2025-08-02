import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

export function useGoogleAPI(targetedURL) {
  const postData = JSON.stringify({
    client: {
      clientId: 'proxyServer-IITI',
      clientVersion: '1.0.0',
    },
    threatInfo: {
      threatTypes: [
        'MALWARE',
        'SOCIAL_ENGINEERING',
        'UNWANTED_SOFTWARE',
        'POTENTIALLY_HARMFUL_APPLICATION',
      ],
      platformTypes: ['WINDOWS'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url: targetedURL }],
    },
  });

  console.log(process.env.GOOGLE_API_KEY);

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

  return new Promise((resolve, reject) => {
    const googleReq = https.request(options, (googleRes) => {
      let body = '';

      googleRes.on('data', (chunk) => (body += chunk));
      googleRes.on('end', () => {
        try {
          const result = JSON.parse(body);
          console.log('result: ',result);
          resolve(Object.keys(result).length === 0?'safe':'unsafe');
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