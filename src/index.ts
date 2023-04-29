import { IncomingMessage, createServer, ServerResponse } from 'http';
import { createSession, updatePrimer, findCodeBlocks, getResponse, runCommands } from './utils.js';
import logger from './file-logger.js';

export async function onRequest(request: IncomingMessage, response: ServerResponse) {
  if (request.url === '/favicon.ico') {
    response.writeHead(404);
    response.end();
    return;
  }

  if (request.method !== 'POST') {
    console.log('Invalid request', request.method, request.url);
    response.writeHead(404);
    response.end();
    return;
  }

  if (request.url === '/primer') {
    updatePrimer(await readBody(request));
    response.writeHead(204);
    return;
  }

  if (request.url !== '/task') {
    response.writeHead(404);
    response.end();
    return;
  }

  try {
    runTask(request, response);
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
    logger.log('ERROR: ' + String(error));
    console.log(error);
  }
}

async function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: any[] = [];
    request.on('data', (c) => chunks.push(c));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

async function runTask(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request);
  let waiting = true;

  request.on('close', () => (waiting = false));
  request.on('error', () => (waiting = false));

  const session = createSession(body);
  logger.log('START: ' + body);
  let maxCycles = 10;

  while (maxCycles) {
    if (!waiting) {
      logger.log('CANCELLED');
      break;
    }

    const completion = await getResponse(session.messages);
    session.messages.push({
      role: 'assistant',
      content: completion,
    });

    const commands = findCodeBlocks(completion);
    logger.log('NEXT: ' + completion);
    logger.log('COMMANDS:\n' + commands.join('\n'));

    if (!commands.length) {
      logger.log('HALT');
      break;
    }

    const run = await runCommands(commands);

    if (run.ok) {
      session.messages.push({
        role: 'user',
        content:
          'These are the results:\n' +
          run.outputs.map((o) => ['# ' + o.cmd, (o.output.stdout || 'no output')].join('\n')).join('\n\n') +
          '\n\nAnything else?',
      });
    }

    if (!run.ok) {
      const lastCmd = run.outputs[run.outputs.length - 1];
      const error = String(lastCmd.output.error || lastCmd.output.stderr);

      maxCycles--;
      session.messages.push({
        role: 'user',
        content: `The command:\n\`${lastCmd.cmd}\`\n has failed with this error:\n${error}\nFix the command and write in the next instruction.`,
      });
    }
  }

  const sessionJson = JSON.stringify(session.messages.slice(3));
  logger.log('END: ' + sessionJson);
  response.end(sessionJson);
}

if (process.env.PORT) {
  createServer(onRequest).listen(process.env.PORT, () => {
    process.chdir(process.env.APP_WORKDIR);
    console.log('Started at %s and %d', process.env.APP_WORKDIR, process.env.PORT);
  });
}
