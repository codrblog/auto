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
    console.log('INPUT %s\n', body);

    while (1) {
      const completion = await getResponse(session.messages);
      session.messages.push({
        role: 'assistant',
        content: completion,
      });

      const commands = findCodeBlocks(completion);
      console.log('NEXT %s', completion);
      console.log('COMMANDS:', JSON.stringify(commands, null, 2));

      if (!commands) {
        console.log('HALT');
        break;
      }

      const run = await runCommands(commands);

      if (run.ok) {
        session.messages.push({
          role: 'user',
          content:
            'These are the results:\n```' +
            run.outputs.map((o) => ['#' + o.cmd, o.output.stdout].join('\n')).join('\n\n') +
            '```\nAnything else to execute?',
        });
        // console.log('COMPLETED');
        // break;
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
    console.log('ERROR', error);
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
