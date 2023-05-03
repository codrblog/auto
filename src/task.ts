import { randomUUID } from 'crypto';
import { createSession, findCodeBlocks, getResponse, readBody } from './utils.js';
import logger from './file-logger.js';
import { runCommands } from './shell.js';
import { completeStream, sendEvent } from './streams.js';

interface Task {
  files: string[];
  task: string;
}

export function readTaskFromText(text: string): Task {
  let header = '';
  let body = text;

  if (text.includes('---')) {
    const separationAt = text.indexOf('---');
    header = text.slice(0, separationAt).trim();
    body = text.slice(separationAt + 3).trim();
  }

  const task: Task = {
    files: [],
    task: body.trim().replace(/^\s+/gm, ''),
  };

  if (header) {
    readFields(header, task);
  }

  return task;
}

function readFields(text: string, task: Task) {
  const header = text.trim();

  header.split('\n').forEach((next) => {
    let [field, fieldValue] = next.trim().split(/[:]\s?/);

    field = field.toLowerCase();

    if (field == 'file') {
      task.files.push(fieldValue);
      return;
    }

    console.log('Unknown field: %s => %s in %s', field, fieldValue, next);
  });
}

export async function standaloneTask(request, response) {
  const task = await readBody(request);
  const uid = randomUUID();

  response.writeHead(302, {
    'Session-ID': uid,
    Location: `https://${request.headers['x-forwarded-for']}/events?uid=${uid}`,
  });
  response.end(uid);

  await tryTask(task, uid);
}

export async function tryTask(task: string, uid = randomUUID()) {
  try {
    await runTask(uid, task);
  } catch (error) {
    sendEvent(uid, 'error', String(error));
    logger.log('ERROR: ' + String(error));
  } finally {
    completeStream(uid);
  }
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

    if (process.env.DEBUG) {
      logger.log('NEXT: ' + completion);
      logger.log('COMMANDS:\n' + commands.join('\n'));
    }

    if (!commands.length) {
      logger.log('HALT');
      sendEvent(uid, 'halt', null);
      break;
    }

    const run = await runCommands(commands);

    if (run.ok) {
      const runOutput = run.outputs.map((o) => ['# ' + o.cmd, o.output.stdout || 'no output'].join('\n')).join('\n\n');
      sendEvent(uid, 'results', runOutput);
      maxCycles = 5;
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
        content: `Command \`${lastCmd.cmd}\` has failed with this error:\n${error}\nFix the command and write in the next instruction.`,
      });
    }
  }

  const sessionJson = JSON.stringify(session.messages.slice(3));
  logger.log('END: ' + sessionJson);
  sendEvent(uid, 'history', session.messages.slice(3));

  return sessionJson;
}

