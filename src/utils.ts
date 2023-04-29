import { readFileSync } from 'fs';
import { ChatCompletionRequestMessage } from 'openai';
import { ExecOutput, execString } from '@cloud-cli/exec';
import ai from 'openai';

const preamble = {
  text: readFileSync('./primer.txt', 'utf-8'),
}

export function findCodeBlocks(text: string) {
  const commands: string[] = [];
  const singleCommand = text.startsWith('#shell') || text.startsWith('# shell');

  if (text.indexOf('```') === -1 && !singleCommand) {
    return [];
  }

  if (singleCommand) {
    return [text.trim()];
  }

  while (1) {
    let start = text.indexOf('```');

    if (start === -1) break;

    let end = text.indexOf('```', start + 3);
    commands.push(text.slice(start + 3, end).trim());
    text = text.slice(end + 3);
  }

  return commands;
}

export function updatePrimer(input: string) {
  preamble.text = input;
}

export function createSession(input: string) {
  const messages: ChatCompletionRequestMessage[] = [
    { role: 'system', content: preamble.text },
    { role: 'assistant', content: "Yes, I'm ready! What's the task?" },
    { role: 'user', content: input },
  ];

  return { messages };
}

export async function getResponse(messages: ChatCompletionRequestMessage[]) {
  console.info('Completions for:\n %s', messages[messages.length - 1].content);

  const connector = getOpenAiConnector();
  const start = Date.now();
  const completion = await connector(messages);
  const end = Date.now();

  console.info('Completions finished in %d seconds', (end - start) / 1000);

  return completion.data.choices.map((c) => c.message?.content).join('\n');
}

function getOpenAiConnector() {
  const model = String(process.env.API_MODEL);
  const apiKey = String(process.env.API_KEY);
  const configuration = new ai.Configuration({ apiKey });
  const openai = new ai.OpenAIApi(configuration);

  return (messages: any) => openai.createChatCompletion({ model, messages });
}

function sanitizeCommand(cmd) {
  return cmd
    .split('\n')
    .filter((s) => !s.startsWith('#'))
    .join('\n');
  // .map(s => { s = s.trim(); return s.endsWith('\\') ? s.slice(0, -1) : s + ';'; })
  // .join(' ');
}

export async function runCommands(commands: string[]) {
  const outputs: Array<{ cmd: string; output: ExecOutput }> = [];
  let ok = true;

  for (const cmd of commands) {
    const line = sanitizeCommand(cmd);
    const sh = await execString(line);
    outputs.push({ cmd: line, output: sh });

    if (!sh.ok && sh.code === 0) {
      sh.ok = true;
      sh.stderr = '';
      sh.error = undefined;
    }

    if (!sh.ok && sh.code !== 0) {
      ok = false;
      break;
    }
  }

  return { ok, outputs };
}
