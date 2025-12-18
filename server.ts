// Load environment variables FIRST using require (executes before imports)
const dotenvResult = require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
if (dotenvResult.error) {
  console.error('Failed to load .env.local:', dotenvResult.error);
} else {
  console.log('✅ Loaded environment variables from .env.local');
}

// Now import other modules (which may use env vars)
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeSocket } from './src/lib/socket/server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.io
  initializeSocket(httpServer);

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});

