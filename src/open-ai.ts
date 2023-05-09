import { readFileSync } from 'fs';
import ai from 'openai';
import type { ChatCompletionRequestMessage } from 'openai';

const preamble = {
  text: readFileSync('./primer.txt', 'utf-8'),
};

export async function getResponse(uid: string, messages: ChatCompletionRequestMessage[]) {
  console.info('Completions for:\n %s', messages[messages.length - 1].content);

  const connector = getOpenAiConnector();
  const start = Date.now();
  const completion = await connector(messages);
  const end = Date.now();

  console.info('Completions finished in %d seconds', (end - start) / 1000);

  return {
    uid,
    completion: completion.data.choices.map((c) => c.message?.content).join('\n')
  };
}

export function createSession(input: string) {
  const messages: ChatCompletionRequestMessage[] = [
    { role: 'system', content: preamble.text },
    { role: 'assistant', content: "Yes, I'm ready! What's the task?" },
    { role: 'user', content: input },
  ];

  return { messages };
}

function getOpenAiConnector() {
  const model = String(process.env.API_MODEL);
  const apiKey = String(process.env.API_KEY);
  const configuration = new ai.Configuration({ apiKey });
  const openai = new ai.OpenAIApi(configuration);

  return (messages: any) => openai.createChatCompletion({ model, messages });
}
