import { readFileSync } from 'fs';
import { ChatCompletionRequestMessage } from 'openai';
import { ExecOutput, execString } from '@cloud-cli/exec';
import ai from 'openai';

const preamble = readFileSync('./primer.txt', 'utf-8');

export function findCodeBlocks(text: string) {
  const commands: string[] = [];

  if (text.indexOf('```') === -1) {
    return [];
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

export function createSession(input: string) {
  const messages: ChatCompletionRequestMessage[] = [
    { role: 'system', content: preamble },
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

export async function runCommands(commands: string[]) {
  const outputs: Array<{ cmd: string; output: ExecOutput }> = [];
  let ok = true;

  for (const cmd of commands) {
    const line = cmd
      .split('\n')
      .filter((s) => !s.startsWith('#'))
      .join('\n');
    const sh = await execString(line);

    console.log(line, sh);
    outputs.push({ cmd, output: sh });

    if (!sh.ok) {
      ok = false;
      break;
    }
  }

  return { ok, outputs };
}