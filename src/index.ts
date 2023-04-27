import { IncomingMessage, createServer } from 'http';
import { createSession, findCodeBlocks, getResponse, runCommands } from './utils';
// import { createReadStream, readdirSync } from 'fs';
// import { join } from 'path';

// const CWD = process.cwd();
// const assets = readdirSync(join(CWD, 'assets'));

export async function onRequest(request, response) {
  if (request.url === '/favicon.ico') {
    response.writeHead(404);
    response.end();
    return;
  }

  // if (assets.includes(request.url.slice(1))) {
  //   createReadStream(join(CWD, 'assets', request.url.slice(1))).pipe(response);
  //   return;
  // }

  if (request.method !== 'POST') {
    response.writeHead(404);
    response.end();
  }

  const body = await readBody(request);

  try {
    const session = createSession(body);
    console.log(body);

    while (0) {
      const completion = await getResponse(session.messages);
      const commands = findCodeBlocks(completion);

      console.log('NEXT', completion, commands);

      if (!commands) {
        console.log('HALT');
        break;
      }

      const run = await runCommands(commands);

      if (run.ok) {
        break;
      }

      const lastCmd = run.outputs[run.outputs.length - 1];
      const error = String(lastCmd.output.error || lastCmd.output.stderr);
      session.messages.push({
        role: 'user',
        content: `The command \`${lastCmd.cmd}\` failed with this error: ${error}. Fix it and give me the next command block.`,
      });
    }

    response.end(JSON.stringify(session.messages.slice(3)));
  } catch (error) {
    console.log(error);
    response.writeHead(500);
    response.end(String(error));
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
