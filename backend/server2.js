import http from 'http';
import net from 'net';
import url from 'url';

// Create an HTTP server for handling both HTTP and HTTPS proxying
// This req and res are the exact objects that represents the client(user) req and res (req.method === GET)
const httpServer = http.createServer((req, res) => {
  // Parse the full URL from the request
  const parsedUrl = url.parse(req.url);

  // For testing purposes
  if (!['example.com', 'www.example.com'].includes(parsedUrl.hostname)) {
    res.writeHead(403);
    res.end('Only example.com is allowed');
    return;
  }

  // Only allow HTTP URLs in this route (HTTPS handled via CONNECT)
  if (!/^http:/.test(req.url)) {
    res.writeHead(400);
    res.end('Only HTTP URLs are supported here.');
    return;
  }

  // Log the req related info
  // console.log(`HTTP request: `,req)
  console.log(`✅ HTTP request to: ${req.url}`);
  // console.log(`HTTP request headers: `,req.method)

  // Forward the request to the actual target server
  const proxyReq = http.request(
    {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.path,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      // console.log('HTTP res from server: ', proxyRes);
      // console.log('HTTP res headers from server: ', proxyRes.headers);

      // Relay status and headers from the target back to the browser
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      // Pipe the response body back to the client
      proxyRes.pipe(res);
    }
  );

  // Handle any errors during the proxy request
  proxyReq.on('error', (err) => {
    console.error('HTTP Proxy error:', err.message);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  // Pipe the original request body to the target server
  req.pipe(proxyReq);
});

// Handle HTTPS requests via the CONNECT method
// This req is not the https req made by client(user) it the req made by browser itself (req.method === CONNECT)
httpServer.on('connect', (req, clientSocket, head) => {
  // Example: req.url = "example.com:443"
  const [host, portRaw] = req.url.split(':');
  const port = parseInt(portRaw, 10) || 443;

  //For testing purposes
  if (!['example.com', 'www.example.com'].includes(host)) {
    console.log(`❌ Blocked CONNECT to ${host}`);
    clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    clientSocket.end();
    return;
  }

  // Log the tunneling request
  console.log(`✅ HTTPS tunnel request to: ${host}:${port}`);
  // console.log(`Client Socket: `,clientSocket)
  console.log(`Client req: `, req); //readable
  // Create a raw TCP connection to the destination server
  const serverSocket = net.connect(port, host, () => {
    // Notify the browser that the tunnel is ready
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

    // Forward any remaining data from the initial request (usually empty)
    serverSocket.write(head);

    // This data is unreadable i am getting garbage
    // clientSocket.on('data', (chunk) =>
    //   console.log('Moment of Truth: ', chunk.toString())
    // );

    // console.log(clientSocket); //readable

    // Pipe encrypted data in both directions (tunnel)
    // Imagine two people talking on the phone in a foreign language. You’re just holding two walkie-talkies and connecting them.
    // These are just socket objects to handle connection they are READABLE but data transfering bw the is NOT
    clientSocket.pipe(serverSocket);
    serverSocket.pipe(clientSocket);
  });

  // This data as expected is also unreadable
  // serverSocket.on('data', (chunk) => {
  //   console.log('Moment of Truth again:',chunk.toString());
  // });

  // Handle any errors with the tunnel
  serverSocket.on('error', (err) => {
    console.error('HTTPS Tunnel error:', err.message);
    clientSocket.end();
  });
});

// Start the proxy server
const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Proxy server listening on http://localhost:${PORT}`);
  console.log(`Supports both HTTP and HTTPS (via CONNECT)`);
});
