import http from 'http';
import https from 'https';
import net from 'net';
import url from 'url';
import { useGoogleAPI } from './utils/googleSafeBrowsing.js';
import { renderEjs } from './utils/render.js';
import { checkSecurityHeaders } from './utils/securityHeaders.js';
import { createFakeCert } from './utils/createCert.js';
// Note on Asynchronous Execution: Callbacks and event handlers execute when their respective events occur, not necessarily in the order they are defined in the code.

// HTTP handler
const httpServer = http.createServer(async (clientReq, clientRes) => {
  //This callback is executed everytime our proxy receives a http request i.e. whenever the client tries to vist http websites
  //clientReq and clientRes is the req and res received and sent to chrome respectively

  // Handle client request errors
  clientReq.on('error', err => {
    console.error('clientReq error:', err.message);
    clientRes.writeHead(400);
    clientRes.end('Client Request Error');
  });

  // Extracting info from the url of website that user wants to browse
  // Passing true so that is parse query strings also
  const parsedUrl = url.parse(clientReq.url, true);

  // Configuring req object to make request to actual server
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 80,
    path: parsedUrl.path,
    method: clientReq.method,
    headers: { ...clientReq.headers },
  };

  const fullUrl = `http://${options.hostname}:${options.port}${options.path}`;

  // Starts sending request to actual server, for now just send headers and sets up the connection
  // will setup body(payload) of req later on
  const proxyReq = http.request(options, async (proxyRes) => {
    // This callback is executed when our proxy server starts receiving the http response from the server
    try {
      // if url don't have continue === true in query string => we've show response page
      // Whereas if url have continue === true in query string => we've to redirect user to actual website
      if (!parsedUrl.query.continue) {
        // Checking url in google db
        const googleApiResult = await useGoogleAPI(fullUrl);

        // Checking security headers
        const headersResult = checkSecurityHeaders(proxyRes.headers, 'http');

        // This is the object passed while rendering response.ejs(our response page)
        // The properties of this object will become global in reponse.ejs => we can access its properties directly in the response.ejs
        const valueObj = {
          protocol: 'http',
          googleApiResult,
          headerScore: headersResult.headersScore, // a calculated score on the basis of number of headers used by website
          headerMessage: headersResult.headersMessage, // a customised message for user on resposne page regarding headers
          missingHeaders: headersResult.missingHeaders, // showing user the security headers that website doesn't use on response page
          sslTlsStatus: 'N/A (HTTP)', // As this is http version ssl/tls makes no sense
          redirectTo: fullUrl, // The url of website user wants to browse where we've to redirect user if she/he choose to continue
        };

        // Rendering reponse.ejs(response page) to user
        return renderEjs(clientRes, valueObj);
      }

      // All the below code under this cb will only be executed if user chooses to continue to the website

      // Writing header for clientRes
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);

      // If any data has came along with the proxyRes forward it with clientRes
      proxyRes.on('data', (chunk) => {
        clientRes.write(chunk);
      });

      // As the proxy receives the complete res finish sending the res to chrome
      proxyRes.on('end', () => {
        clientRes.end();
      });
    } catch (error) {
      console.log('Error in proxyReq cb in http server: ', error.message);
      clientRes.end('Error in proxyReq cb in http server');
    }
  });

  // Handle proxy request errors
  proxyReq.on('error', (err) => {
    console.error('proxyReq error:', err.message);
    clientRes.writeHead(502);
    clientRes.end('Bad Gateway');
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
});

// HTTPS MitM handler or you can say CONNECT Listener
httpServer.on('connect', (req, clientSocket, head) => {
  // This callback is executed everytime chrome make a connect request to our proxy
  // req is not the req made by user the but the CONNECT req made by chrome
  // clientSocket is the socket on which chrome is listening
  // head is any left over data

  // Handle client socket errors
  clientSocket.on('error', err => {
    console.error('clientSocket error:', err.message);
  });

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

      // Handle https request errors
      httpsReq.on('error', err => {
        console.error('httpsReq error:', err.message);
      });

      try {
        // Extracting info from the url of website that user wants to browse
        // Passing true so that is parse query strings also
        const parsedUrl = url.parse(httpsReq.url, true);

        // Configuring req object to make request to actual server
        const options = {
          hostname: parsedUrl.hostname || host,
          port: parsedUrl.port || 443,
          path: parsedUrl.path,
          method: httpsReq.method,
          headers: httpsReq.headers,
        };

        const fullUrl = `https://${options.hostname}:${options.port}${options.path}`;

        // Starts making req to actual server
        const proxyReq = https.request(options, async (proxyRes) => {
          // This callback is executed when our duplicate https server starts receiving response from the actual server
          //proxyRes is the response received from the real target server.

          // if url don't have continue === true in query string => we've show response page
          // Whereas if url have continue === true in query string => we've to redirect user to actual website
          if (!parsedUrl.query.continue) {
            // Checking url in google db
            const googleApiResult = await useGoogleAPI(fullUrl);

            // Checking security headers
            const headersResult = checkSecurityHeaders(
              proxyRes.headers,
              'https'
            );

            // This is the object passed while rendering response.ejs(our response page)
            // The properties of this object will become global in reponse.ejs => we can access its properties directly in the response.ejs
            const valueObj = {
              protocol: 'https',
              googleApiResult,
              headerScore: headersResult.headersScore, // a calculated score on the basis of number of headers used by website
              headerMessage: headersResult.headersMessage, // a customised message for user on resposne page regarding headers
              missingHeaders: headersResult.missingHeaders, // showing user the security headers that website doesn't use on response page
              sslTlsStatus: 'Aneekesh bhai ki JAI HO!!!', // Have not implemented ssl/tls certificate check yet
              redirectTo: fullUrl, // The url of website user wants to browse where we've to redirect user if she/he choose to continue
            };

            // Rendering reponse.ejs(response page) to user
            return renderEjs(httpsRes, valueObj);
          }

          // All the below code under this cb will only be executed if user chooses to continue to the website

          //setting headers for the response to chrome
          httpsRes.writeHead(proxyRes.statusCode, proxyRes.headers);

          //send any data came along with proxyRes to httpsRes
          //and end httpsRes as soon as proxyRes ends
          proxyRes.pipe(httpsRes);
        });

        // Handle proxy request errors
        proxyReq.on('error', (err) => {
          console.error('proxyReq (HTTPS) error:', err.message);
          httpsRes.writeHead(502);
          httpsRes.end('Bad Gateway');
        });

        //send any data came along with httpsReq to proxyReq
        //and end proxyReq as soon as httpsReq ends
        httpsReq.pipe(proxyReq);
      } catch (error) {
        console.log('Error in https server cb :', error.message);
        httpsRes.end('Error in https server cb');
      }
    }
  );

  // Handle HTTPS server errors
  httpsServer.on('error', (err) => {
    console.error('httpsServer error:', err.message);
    clientSocket.end();
  });

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

      clientSocket.pipe(tunnelSocket);
      tunnelSocket.pipe(clientSocket);
    });

    // Handle tunnel socket errors
    tunnelSocket.on('error', (err) => {
      console.error('tunnelSocket error:', err.message);
      clientSocket.end();
    });
  });
});

// Handle httpServer errors (like EADDRINUSE)
httpServer.on('error', (err) => {
  console.error('httpServer error:', err.message);
});

const PORT = 3000; // Define PORT before using
// Starts listening to request on our whole proxy server
httpServer.listen(PORT, () => {
  console.log(`🔐 MITM Proxy running on port ${PORT}`);
});

// Global error handling
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
