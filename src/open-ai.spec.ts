const openAiMock = jest.fn();
const createChatCompletion = jest.fn();

class OpenAiMock {
  createChatCompletion = createChatCompletion;
}

openAiMock.mockImplementation(() => ({
  Configuration: class {},
  OpenAIApi: OpenAiMock,
}));

jest.mock('openai', () => openAiMock());

import { getResponse, createSession } from './open-ai.js';

describe('createSession', () => {
  it('should prepare for next task', () => {
    const session = createSession('input');

    expect(session).toEqual({
      messages: [
        { role: 'system', content: expect.any(String) },
        { role: 'assistant', content: "Yes, I'm ready! What's the task?" },
        { role: 'user', content: 'input' },
      ],
    });
  });
});

describe('fetch a completion', () => {
  it('should call the API for a completion', async () => {
    process.env.API_MODEL = 'model';
    process.env.API_KEY = 'apiKey';

    const completion = { message: { role: 'assistant', content: 'ai response' } };
    const response = { data: { choices: [completion] } };

    createChatCompletion.mockImplementation(() => response);

    const input = 'test';
    const session = createSession(input);
    const output = await getResponse('123', session.messages);

    expect(createChatCompletion).toHaveBeenCalledWith({
      model: 'model',
      messages: [
        { role: 'system', content: expect.any(String) },
        { role: 'assistant', content: "Yes, I'm ready! What's the task?" },
        { role: 'user', content: input },
      ],
    });

    expect(output).toEqual({
      uid: '123',
      completion: 'ai response',
    });
  });
});
