import { IncomingMessage, createServer, ServerResponse } from 'http';
import { createSession, updatePrimer, findCodeBlocks, getResponse, runCommands } from './utils.js';
import logger from './file-logger.js';
import { randomUUID } from 'crypto';

const streams = new Map();
const sendEvent = (uid, eventName, data) => {
  if (!streams.has(uid)) { return; }

  const stream = streams.get(uid);
  stream.write('event: ' + eventName + '\n');
  stream.write('data: ' + JSON.stringify(data) + '\n\n');
};

export async function onRequest(request: IncomingMessage, response: ServerResponse) {
  if (request.url === '/favicon.ico') {
    response.writeHead(404);
    response.end();
    return;
  }

  const incoming = new URL(request.url, `http://${request.headers['x-forwarded-for']}`);

  if (incoming.pathname === '/events' && request.method === 'GET') {
    const uid = incoming.searchParams.get('uid');
    
    if (uid) {
      streams.set(uid, response);
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.writeHead(200);
      return;
    }
  }

  if (request.method !== 'POST') {
    console.log('Invalid request', String(incoming));
    response.writeHead(404);
    response.end();
    return;
  }

  if (incoming.pathname === '/primer') {
    updatePrimer(await readBody(request));
    response.writeHead(204);
    return;
  }

  if (incoming.pathname === '/issues') {
    const body = await readBody(request);
    response.writeHead(202);
    response.end();
    console.log(JSON.parse(body));
    return;
  }

  if (incoming.pathname !== '/task') {
    response.writeHead(404);
    response.end();
    return;
  }
  
  const uid = randomUUID();
  response.writeHead(302, { 
    'Session-ID': uid,
    'Location': `https://${request.headers['x-forwarded-for']}/events?uid=${uid}`
  });
  response.end(uid);

  try {
    const task = await readBody(request);
    await runTask(uid, task);
  } catch (error) {
    sendEvent(uid, 'error', String(error));
    logger.log('ERROR: ' + String(error));
  } finally {
    streams.get(uid)?.end();
    streams.delete(uid);
  }
}

async function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: any[] = [];
    request.on('data', (c) => chunks.push(c));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

async function runTask(uid: string, task: string) {
  let maxCycles = 5;
  const session = createSession(task);

  while (maxCycles) {
    const completion = await getResponse(session.messages);
    session.messages.push({
      role: 'assistant',
      content: completion,
    });

    const commands = findCodeBlocks(completion);
    sendEvent(uid, 'next', completion);
    logger.log('NEXT: ' + completion);
    logger.log('COMMANDS:\n' + commands.join('\n'));

    if (!commands.length) {
      logger.log('HALT');
      sendEvent(uid, 'halt', null);
      break;
    }

    const run = await runCommands(commands);

    if (run.ok) {
      const runOutput = run.outputs.map((o) => ['# ' + o.cmd, (o.output.stdout || 'no output')].join('\n')).join('\n\n');
      sendEvent(uid, 'results', runOutput);
      session.messages.push({
        role: 'user',
        content: `Results:\n${runOutput}\n\nAnything else?`,
      });
    }

    if (!run.ok) {
      const lastCmd = run.outputs[run.outputs.length - 1];
      const error = String(lastCmd.output.error || lastCmd.output.stderr);
      sendEvent(uid, 'error', error);
      maxCycles--;
    
      session.messages.push({
        role: 'user',
        content: `The command \`${lastCmd.cmd}\`  has failed with this error:\n${error}\nFix the command and write in the next instruction.`,
      });
    }
  }

  const sessionJson = JSON.stringify(session.messages.slice(3));
  logger.log('END: ' + sessionJson);
  sendEvent(uid, 'history', session.messages.slice(3));
  
  return sessionJson;
}

if (process.env.PORT) {
  createServer(onRequest).listen(process.env.PORT, () => {
    process.chdir(process.env.APP_WORKDIR);
    console.log('Started at %s and %d', process.env.APP_WORKDIR, process.env.PORT);
  });
}
