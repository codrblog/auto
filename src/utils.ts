import { readFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { ChatCompletionRequestMessage } from 'openai';
import ai from 'openai';

const preamble = {
  text: readFileSync('./primer.txt', 'utf-8'),
};

export function findCodeBlocks(text: string) {
  const commands: string[] = [];
  const singleCommand = text.startsWith('#shell') || text.startsWith('# shell');

  if (text.indexOf('```') === -1 && !singleCommand) {
    return [];
  }

  if (singleCommand) {
    return [text.trim()];
  }

  const shellStart = /^shell\b/;

  while (1) {
    const start = text.indexOf('```');

    if (start === -1) break;

    const end = text.indexOf('```', start + 3);
    let next = text.slice(start + 3, end).trim();
    next = next.replace(shellStart, '');
    commands.push('set -e\n' + next.trim());
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

export async function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: any[] = [];
    request.on('data', (c) => chunks.push(c));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
