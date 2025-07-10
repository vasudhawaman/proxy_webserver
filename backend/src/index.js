import http from 'http';
import { handleHttpRequest } from './handlers/httpHandler.js';
import { handleHttpsConnect } from './handlers/httpsHandler.js';
import { attachGlobalErrorHandlers } from './errorHandlers/globalErrors.js';

const PORT = 3000;
const httpServer = http.createServer(handleHttpRequest);

// Handle HTTPS CONNECT requests (MitM)
httpServer.on('connect', handleHttpsConnect);

// Handle server errors like EADDRINUSE
httpServer.on('error', (err) => {
  console.error('httpServer error:', err.message);
});

// Attach global process-level error handlers
attachGlobalErrorHandlers();

httpServer.listen(PORT, () => {
  console.log(` MITM Proxy running on port ${PORT}`);
});
