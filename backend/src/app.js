const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const ejs = require('ejs');

//currently our server, becuse of globally defined userAgent, cant handle multiple users at once
//by setting this userAgent our prozy can mimic the browser, because without it the server will treat our proxy as a plain nodejs server
//due to which it doesnt respond with all the security headers that a actuall browser needs
let userAgent = '';

function renderFile(res, filePath, errMsg) {
  //reading file
  fs.readFile(path.join(filePath), (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end(errMsg);
    }

    //sending file
    res.writeHead(200);
    return res.end(data);
  });
}

function renderEjs(res, valueObj) {
  //this function is for rendering response.ejs: it is dynamic wrt reponse of server i.e its content chnages wrt proxy reposne thats why..
  //... we need ejs instead of html
  ejs.renderFile(
    path.join(__dirname, '..', 'src', 'html', 'response.ejs'),
    valueObj,
    (err, html) => {
      if (err) {
        console.log(err);
        res.writeHead(500);
        return res.end('Error rendering EJS');
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    }
  );
}

function useGoogleAPI(targetedURL) {
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

      googleRes.on('data', (chunk) => {
        body += chunk;
      });

      googleRes.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(Object.keys(result).length === 0); // true if safe, false if unsafe
        } catch (err) {
          reject(new Error('Failed to parse Google API response'));
        }
      });
    });

    googleReq.on('error', (err) => {
      reject(err);
    });

    googleReq.write(postData);
    googleReq.end();
  });
}

function checkSecurityHeaders(httpsRes) {

  //the header we have to check upon
  const securityHeadersArr = [
    'x-content-type-options',
    'content-security-policy',
    'x-xss-protection',
    'strict-transport-security',
    'x-frame-options',
  ];

  const absentHeaders = securityHeadersArr.filter((header) => {
    return !httpsRes.headers[header];
  });

  const total = securityHeadersArr.length;
  const missing = absentHeaders.length;
  const score = ((total - missing) / total) * 100;

  let riskLevel = '';
  if (missing >= 4) {
    riskLevel =
      '⚠️ High chance the website may be unsafe. Avoid entering sensitive information unless absolutely sure.';
  } else if (missing >= 2) {
    riskLevel =
      '⚠️ Some common security headers are missing. Avoid sharing personal or financial info on this site.';
  } else if (missing === 1) {
    riskLevel =
      '✅ Slightly below optimal security, but generally safe to browse.';
  } else {
    riskLevel =
      '✅ All recommended security headers are present. You may safely browse the website';
  }

  return {
    score,
    message: riskLevel,
    missingHeaders: absentHeaders,
  };
}

function sendReqToGlobalServer(res, targetedURL) {
  const { hostname, protocol } = new URL(targetedURL);

  const parsedProtocol = protocol.replace(':', '');

  if (parsedProtocol === 'http') {

    //if the website uses http simply repond with unsafe and finish checking : http websites are considered unsafe 
    return renderEjs(res, {
      http: true,
      status: null,
      score: null,
      missingHeaders: null,
      redirectURL: targetedURL,
    });
  }

  const scheme = parsedProtocol === 'http' ? http : https;

  const options = {
    hostname: hostname,
    path: '/',
    method: 'GET',
    headers: {
      //see here we set the userAgent to mimic our proxy as a browser
      'User-Agent': userAgent,
    },
    //to check for ssl certificate 
    rejectUnauthorized: true,
  };

  const serverReq = scheme.request(options, (serverRes) => {
    let data = '';

    serverRes.on('data', (chunk) => (data += chunk));

    serverRes.on('end', () => {
      const result = checkSecurityHeaders(serverRes);

      return renderEjs(res, {
        http: false,
        status: result.message,
        score: result.score,
        missingHeaders: result.missingHeaders,
        redirectURL: targetedURL,
      });
    });

    serverRes.on('error', () => {
      res.writeHead(500);
      res.end('Error fetching the target website.');
    });
  });

  serverReq.on('error', () => {
    res.writeHead(500);
    res.end(
      'Error connecting to the target website. Maybe check if the website is down.'
    );
  });

  serverReq.end();
}

function getHomepageRoute(req, res) {
  //when the user makes request its header contains the userAgent for the user's browser, we require it so we are extracting this
  userAgent = req.headers['user-agent'];

  //send homepage (index.html)
  renderFile(
    res,
    path.join(__dirname, '..', '..', 'frontend/index.html'),
    'Error rendering homepage'
  );
}

function checkSafety(req, res) {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  //now body have all the data that was sent in post req, but still we need to extract ip url from it
  req.on('end', async () => {
    const params = new URLSearchParams(body);
    const targetedURL = params.get('ipURL');
    // this targetedURL have the the url that user entered in the correct form

    if (!targetedURL) {
      res.writeHead(400);
      return res.end('URL not provided');
    }

    try {
      if (!(await useGoogleAPI(targetedURL))) {

        //if the website marked undafe in google api just finish the checking and resond with unsafe. We are here trusting google
        return renderEjs(res, {
          http: false,
          status: `⚠️ Caution: Google marked this site as unsafe to browse. We don't recommend you to browse this website.`,
          score: null,
          missingHeaders: null,
          redirectURL: targetedURL,
        });
      }

      //sending request to global server only if the website is safe in google api
      sendReqToGlobalServer(res, targetedURL);
    } catch (err) {
      res.writeHead(500);
      res.end(`Error checking site safety: ${err.message}`);
    }
  });

  req.on('error', () => {
    res.writeHead(500);
    res.end('Error reading request data.');
  });
}

const proxy = http.createServer((req, res) => {
  //when user visits the website for the first time : prviding the homepage
  if (req.url === '/' && req.method === 'GET') {
    getHomepageRoute(req, res);
  } else if (req.url === '/isSafe' && req.method === 'POST') {
    // this is when user submits the form while filling it with the url
    checkSafety(req, res);
  } else if (
    // this path is for rendering bg image on homepage
    req.url === '/frontend/assets/images/bg.jpg' &&
    req.method === 'GET'
  ) {
    renderFile(
      res,
      path.join(__dirname, '..', '..', 'frontend/assets/images/bg.jpg'),
      'Error rendering image'
    );
  } else {
    res.writeHead(404);
    res.end('Route not found');
  }
});

proxy.listen(9001, () => {
  console.log('Proxy server listening on port 9001');
});
