import { createServer } from 'node:http';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '127.0.0.1';

const server = createServer(createApp());

server.listen(port, host, () => {
  console.log(`TENG Smart Parking running at http://${host}:${port}`);
});

