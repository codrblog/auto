import { IncomingMessage, createServer, ServerResponse } from 'http';
import { addStream } from './streams.js';
import { fromWebhook } from './webhook.js';
import { standaloneTask } from './task.js';
import { eventBus } from './events.js';
import { getResponse } from './open-ai.js';

export async function onRequest(request: IncomingMessage, response: ServerResponse) {
  if (request.url === '/favicon.ico') {
    response.writeHead(404);
    response.end();
    return;
  }

  const incoming = new URL(request.url, `http://${request.headers['x-forwarded-for']}`);
  if (incoming.pathname === '/events' && request.method === 'GET') {
    const uid = incoming.searchParams.get('uid');

    // TODO protect endpoint against attacks
    if (uid) {
      addStream(uid, response);
    }

    return;
  }

  if (request.method !== 'POST') {
    console.log('Invalid request', String(incoming));
    response.writeHead(404);
    response.end();
    return;
  }

  if (incoming.pathname === '/issues') {
    fromWebhook(request, response);
  }

  if (incoming.pathname !== '/task') {
    standaloneTask(request, response);
    return;
  }

  response.writeHead(404);
  response.end();
}

if (process.env.PORT) {
  createServer(onRequest).listen(process.env.PORT, () => {
    process.chdir(process.env.APP_WORKDIR);
    console.log('Started at %s and %d', process.env.APP_WORKDIR, process.env.PORT);
  });

  eventBus.on('complete', async (event) => {
    const { uid, messages } = event;
    const completion = await getResponse(uid, messages);
    eventBus.emit('completed', { uid, completion });
  });

}
