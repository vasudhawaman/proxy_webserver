import express from 'express';
import http from 'http';
import { URL } from 'url';

const app = express();
const PORT = 3000;


// Catch-all http route for proxying
// this will not work for HTTPS sites as for then chrome send a CONNECT request which our http server can't handle
app.get('/', async (req, res) => {
  console.log('i run')
  console.log(req)
  const targetUrl = req.url;

  console.log(targetUrl)

  if (!targetUrl || !targetUrl.startsWith('http://')) {
    return res.status(400).send('Only http:// URLs are supported in this basic proxy.');
  }

  try {
    const target = new URL(targetUrl);

    const proxyReq = http.request(
      {
        hostname: target.hostname,
        path: target.pathname + target.search,
        port: 80,
        method: 'GET',
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err.message);
      res.status(502).send('Proxy request failed.');
    });

    proxyReq.end();
  } catch (err) { 
    res.status(500).send('Invalid URL.');
  }
});

app.listen(PORT, () => {
  console.log(`HTTP proxy listening on http://localhost:${PORT}`);
});
