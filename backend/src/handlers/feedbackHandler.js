import { addFeedback, clearFeedback, getFeedback } from "../utils/feedback.js";

export const feedbackHandler = async (clientReq, clientRes) => {
  if (clientReq.method === 'POST') {
    let body = '';

    clientReq.on('data', chunk => {
      body += chunk;
    });

    clientReq.on('end', () => {
      try {
        const { url, status } = JSON.parse(body);
        addFeedback(url, status);
        clientRes.writeHead(200, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({ success: true }));
      } catch (err) {
        clientRes.writeHead(400);
        clientRes.end('Invalid JSON');
      }
    });
  } else if (clientReq.method === 'GET') {
    const data = getFeedback();
    clientRes.writeHead(200, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify(data));
  } else if (clientReq.method === 'DELETE') {
    clearFeedback();
    clientRes.writeHead(204);
    clientRes.end();
  } else {
    clientRes.writeHead(405);
    clientRes.end('Method Not Allowed');
  }
};
