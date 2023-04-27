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

import { readFileSync } from 'fs';
import { createSession, findCodeBlocks, getResponse, runCommands } from './utils.js';

const responseText = readFileSync(process.cwd() + '/mocks/response-sh.txt', 'utf8');

describe('commands', () => {
  it('should ignore text without blocks', () => {
    const input = 'simple test';
    const output = findCodeBlocks(input);

    expect(output).toEqual([]);
  });

  it('should find commands in a text', () => {
    const output = findCodeBlocks(responseText);
    const commands = [
      'curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/',
      '# shell\ncurl -X POST -H "Authorization: token $GITHUB_TOKEN" -d \'{"name": "test"}\' https://api.github.com/orgs/octocat/repos',
      'curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/repos/octocat/test | grep -o "git@[^ ]*" | head -n 1',
      'curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/repos/octocat/test',
    ];

    expect(output).toEqual(commands);
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
    const output = await getResponse(session.messages);

    expect(createChatCompletion).toHaveBeenCalledWith({
      model: 'model',
      messages: [
        { role: 'system', content: expect.any(String) },
        { role: 'assistant', content: "Yes, I'm ready! What's the task?" },
        { role: 'user', content: input },
      ],
    });

    expect(output).toBe('ai response');
  });
});

describe('runCommands', () => {
  it('should execute commands in a list', async () => {
    const commands = ['# shell\npwd', 'invalid-command-1'];
    const output = await runCommands(commands);

    expect(output).toEqual({
      ok: false,
      outputs: [
        {
          cmd: commands[0],
          output: {
            code: 0,
            ok: true,
            stdout: process.cwd() + '\n',
            stderr: '',
            error: undefined,
          },
        },
        {
          cmd: commands[1],
          output: {
            code: expect.any(Number),
            ok: false,
            stdout: '',
            stderr: expect.any(String),
            error: expect.any(Error),
          },
        },
      ],
    });
  });
});