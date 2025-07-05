import http from 'http';
import https from 'https';
import net from 'net';
import url from 'url';
import { createFakeCert } from './certUtil.js';

// Note on Asynchronous Execution: Callbacks and event handlers execute when their respective events occur, not necessarily in the order they are defined in the code.

// HTTP handler
const httpServer = http.createServer((clientReq, clientRes) => {
  //This callback is executed everytime our proxy receives a http request i.e. whenever the client tries to vist http websites
  //clientReq and clientRes is the req and res received and sent to chrome respectively

  // Just for the sake of simplicity and double check not a part of logic
  // console.log('Client req.method: ', clientReq.method);
  console.log('Client req.url: ', clientReq.url);
  // console.log('Client req.statusCode: ', clientReq.statusCode);
  // console.log('Client req.headers: ', clientReq.headers);

  // Extracting info from the url of website that user wants to browse
  const parsedUrl = url.parse(clientReq.url);

  // Configuring req object to make request to actual server
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 80,
    path: parsedUrl.path,
    method: clientReq.method,
    headers: { ...clientReq.headers },
  };

  // Starts sending request to actual server, for now just send headers and sets up the connection
  // will setup body(payload) of req later on
  const proxyReq = http.request(options, (proxyRes) => {
    // This callback is executed when our proxy server starts receiving the http response from the server

    // Just for the sake of simplicity and double check not a part of logic
    // console.log('Proxy res.method: ', proxyRes.method);
    console.log('Proxy res.url: ', proxyRes.url);
    // console.log('Proxy res.statusCode: ', proxyRes.statusCode);
    // console.log('Proxy res.header: ', proxyRes.headers);

    // Writing header for clientRes
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);

    // Error handling
    proxyRes.on('error', (err) => {
      console.error(
        'Proxy response stream error (HTTP, from actual server to client):',
        err.message
      );
      if (!clientRes.headersSent) {
        clientRes.writeHead(500); // Internal Server Error
      }
      clientRes.end('Proxy response stream error.');
    });

    // If any data has came along with the proxyRes forward it with clientRes
    proxyRes.on('data', (chunk) => {
      clientRes.write(chunk);
    });

    // As the proxy receives the complete res finish sending the res to chrome
    proxyRes.on('end', () => {
      clientRes.end();
    });
  });

  clientReq.on('data', (chunk) => {
    // If any data has came along with clientReq (maybe a POST req) forwards it with proxyReq
    // This is where we are sending body(payload) of proxyReq
    proxyReq.write(chunk);
  });

  clientReq.on('end', () => {
    // As chrome finish the req end the request to actual server
    proxyReq.end();
  });

  // Error handling
  clientReq.on('error', (err) => {
    console.error(
      'Client request stream error (HTTP, from Chrome to proxy):',
      err.message
    );
    if (!clientRes.headersSent) {
      clientRes.writeHead(500); // Internal Server Error
    }
    clientRes.end('Client request stream error.');
  });

  //Handling errors for the proxy's outbound request to the actual server
  proxyReq.on('error', (err) => {
    console.error('Proxy request error (HTTP, to actual server):', err.message);
    clientRes.writeHead(502);
    clientRes.end('Bad Gateway');
  });
});

// HTTPS MitM handler or you can say CONNECT Listener
httpServer.on('connect', (req, clientSocket, head) => {
  // This callback is executed everytime chrome make a connect request to our proxy
  // req is not the req made by user the but the CONNECT req made by chrome
  // clientSocket is the socket on which chrome is listening
  // head is any left over data

  //Extracting host and port form req.url(eg - example.com:443)
  const [host, port] = req.url.split(':');

  // Obtaining fake certificate and key to sent to chrome so that it can trust our duplicate https server
  const { cert, key } = createFakeCert(host);

  // This is our duplicate https server
  // As this is a https server it need tls/ssl certificate that we are passing
  const httpsServer = https.createServer(
    { key, cert },
    (httpsReq, httpsRes) => {
      // This callback is executes as our https server starts receiving request
      // httpsReq is the req received by our duplicate https server from the chrome which thinks this duplicate https server as the actual server (MitM)
      // httpsRes is the res sent to chrome
      // As mentioned here we can read the data

      // Extracting info from the url of website that user wants to browse
      const parsed = url.parse(httpsReq.url);

      // Just for the sake of simplicity and double check not a part of logic
      // console.log(`🔓 HTTPS request intercepted`);
      // console.log(`🔹 Method: ${httpsReq.method}`);
      console.log(`\nHTTPS req URL: ${httpsReq.url} \n`);
      // console.log(`🔹 Headers:`, httpsReq.headers);

      // Configuring req object to make request to actual server
      const options = {
        hostname: parsed.hostname || host,
        port: parsed.port || 443,
        path: parsed.path,
        method: httpsReq.method,
        headers: httpsReq.headers,
      };

      // Starts making req to actual server
      const proxyReq = https.request(options, (proxyRes) => {
        // This callback is executed when our duplicate https server starts receiving response from the actual server
        //proxyRes is the response received from the real target server.

        //setting headers for the response to chrome
        httpsRes.writeHead(proxyRes.statusCode, proxyRes.headers);

        // Error handling
        proxyRes.on('error', (err) => {
          console.error(
            'HTTPS Proxy response stream error (from actual server to client):',
            err.message
          );
          if (!httpsRes.headersSent) {
            httpsRes.writeHead(500); // Internal Server Error
          }
          httpsRes.end('Proxy response stream error.');
        });

        //send any data came along with proxyRes to httpsRes
        //and end httpsRes as soon as proxyRes ends
        proxyRes.pipe(httpsRes);
      });

      // Error handling
      httpsReq.on('error', (err) => {
        console.error(
          'HTTPS Client request stream error (from Chrome to proxy):',
          err.message
        );
        if (!httpsRes.headersSent) {
          httpsRes.writeHead(500);
        }
        httpsRes.end('Client request stream error.');
      });

      //send any data came along with httpsReq to proxyReq
      //and end proxyReq as soon as httpsReq ends
      httpsReq.pipe(proxyReq);
    }
  );

  // Starts listing for requests on our duplicate https server
  // Node.js will assign a random available port. When no hostname is specified, the server will typically listen on all available network interfaces (0.0.0.0), but we explicitly connect to '127.0.0.1' (localhost) from within the proxy for efficient and secure internal communication over the loopback interface.
  httpsServer.listen(0, () => {
    // This callback start executing as soon as our duplicate https server is set up by nodejs

    // Retrieves the details(port number, ip family, and ip address) that the operating systemhas  assigned to our duplicate https Server.
    const address = httpsServer.address();

    // This is part where our CONNECT listener is connected to our duplicate https server
    // This is the actual tunnel the chrome needed to be set up
    // Connect to our dupilcate https server on its port (address.port) and its ip(127.0.0.1 i.e. localhost)
    const tunnelSocket = net.connect(address.port, '127.0.0.1', () => {
      //This callback executes once the tunnelSocket successfully connects to our duplicate https Server done by nodejs

      //****** Explanation ******
      //clientSocket - where chrome is listening (raw, encrypted data)
      //tunnelSocket - where our duplicate https server is listening (raw, encrypted data)
      // All data exchanged directly on clientSocket and tunnelSocket here is encrypted.
      // Decryption/Encryption happens transparently within the 'httpsServer' before data is passed to its 'request' listener.
      //****** Explanation ******

      //The response sent back to the chrome for the CONNECT req it made.
      //after this only chrome starts sending data to our duplicate https server
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); // This forwards any head that the chrome might have sent immediately after the CONNECT request, pushing it into the newly established secure tunnel.

      tunnelSocket.write(head);

      // Error handling
      tunnelSocket.on('error', (err) => {
        console.error(
          'Tunnel socket error (internal connection):',
          err.message
        );
        clientSocket.destroy(); // Ensure client connection is destroyed
      });

      // Using pipe() for data flow. Errors on piped streams are handled by their 'error' events. // For simplicity, explicit .on('error') on pipe chains are removed.
      // These pipes will implicitly propagate errors, leading to the above .on('error') handlers
      clientSocket.pipe(tunnelSocket);
      tunnelSocket.pipe(clientSocket);
    });
  });

  //Handling errors for the internal HTTPS server
  httpsServer.on('error', (err) => {
    console.error('HTTPS Server Error (internal):', err.message);
    clientSocket.end(); // Attempt to gracefully end the client's connection if the HTTPS server fails
  });
});

const PORT = 3000; // Define PORT before using it in the error handler

// Handling errors for the main HTTP proxy server itself (e.g., port in use)
httpServer.on('error', (err) => {
  console.error('CRITICAL HTTP Server Error (main proxy):', err.message); // Using console.error for critical errors

  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    process.exit(1); // Exit with a non-zero code to indicate an error
  } else {
    console.error('Unexpected HTTP Server error:', err);
    process.exit(1); // Exit for other unexpected server errors
  }
});

// Starts listening to request on our whole proxy server
httpServer.listen(PORT, () => {
  console.log(`🔐 MITM Proxy running on port ${PORT}`);
});
