import http from 'http';
import { handleHttpRequest } from './handlers/httpHandler_aneekesh.js';
import { handleHttpsConnect } from './handlers/httpsHandler_aneekesh.js';
import { attachGlobalErrorHandlers } from './errorHandlers/globalErrors.js';
import 'dotenv/config'

const PORT = process.env.PORT;
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
