const { useGoogleAPI } = require('../utils/googleSafeBrowsing');
const { sendReqToGlobalServer } = require('../utils/securityHeaders');

async function checkSafety(req, res) {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    //body does have the url sent from client but also have some extra content
    const params = new URLSearchParams(body);
    const targetedURL = params.get('ipURL');

    //after this targetedURL have url sent by user in correct format
    if (!targetedURL) {
      res.writeHead(400);
      return res.end('URL not provided');
    }

    try {
      //checking url in google database
      const isSafe = await useGoogleAPI(targetedURL);

      //if unsafe then send response to user
      if (!isSafe) {
        const { renderEjs } = require('../utils/render');
        return renderEjs(res, {
          http: false,
          status: `⚠️ Caution: Google marked this site as unsafe to browse.`,
          score: null,
          missingHeaders: null,
          redirectURL: targetedURL,
        });
      }

      //if safe proceed with request
      sendReqToGlobalServer(res, targetedURL);
    } catch (err) {
      res.writeHead(500);
      res.end(`Error checking site safety: ${err.message}`);
    }
  });
}

module.exports = { checkSafety };
