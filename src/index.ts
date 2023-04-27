import { IncomingMessage, createServer, ServerResponse } from 'http';
import { createSession, findCodeBlocks, getResponse, runCommands } from './utils.js';
import logger from './file-logger.js';

// import { createReadStream, readdirSync } from 'fs';
// import { join } from 'path';

// const CWD = process.cwd();
// const assets = readdirSync(join(CWD, 'assets'));

export async function onRequest(request: IncomingMessage, response: ServerResponse) {
  if (request.url === '/favicon.ico') {
    response.writeHead(404);
    response.end();
    return;
  }

  // if (assets.includes(request.url.slice(1))) {
  //   createReadStream(join(CWD, 'assets', request.url.slice(1))).pipe(response);
  //   return;
  // }

  if (request.method !== 'POST' || request.url !== '/task') {
    console.log('Invalid request', request.method, request.url);
    response.writeHead(404);
    response.end();
  }

  const body = await readBody(request);
  let waiting = true;

  request.on('close', () => (waiting = false));

  try {
    const session = createSession(body);
    logger.log('START: ' + body);

    while (1) {
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

      if (!commands) {
        logger.log('HALT');
        break;
      }

      const run = await runCommands(commands);

      if (run.ok) {
        session.messages.push({
          role: 'user',
          content:
            'These are the results:\n' +
            run.outputs.map((o) => ['#' + o.cmd, o.output.stdout].join('\n')).join('\n\n') +
            '\n\nAnything else to execute?',
        });
      }

      if (!run.ok) {
        const lastCmd = run.outputs[run.outputs.length - 1];
        const error = String(lastCmd.output.error || lastCmd.output.stderr);
        session.messages.push({
          role: 'user',
          content: `The command:\n\`${lastCmd.cmd}\`\n has failed with this error:\n${error}\nFix the command and give me in the next instruction.`,
        });
      }
    }

    const sessionJson = JSON.stringify(session.messages.slice(3));
    logger.log('END: ' + sessionJson);
    response.end(sessionJson);
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

if (process.env.PORT) {
  createServer(onRequest).listen(process.env.PORT);
}
