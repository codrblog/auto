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
import { EventEmitter } from 'events';
import { createSession, updatePrimer, findCodeBlocks, getResponse, runCommands, readBody } from './utils.js';

const responseText = readFileSync(process.cwd() + '/mocks/response-sh.txt', 'utf8');

process.env.APP_LOGS = process.cwd() + '/log.txt';

describe('commands', () => {
  it('should ignore text without blocks', () => {
    const input = 'simple test';
    const output = findCodeBlocks(input);

    expect(output).toEqual([]);
  });

  it('should not ignore text that starts with a comment', () => {
    const inputs = ['# shell\nsimple test', '#shell\nsimple test'];

    inputs.forEach((input) => expect(findCodeBlocks(input)).toEqual([input]));
  });

  it('should find commands in a text', () => {
    const output = findCodeBlocks(responseText);
    const commands = [
      'set -e\ncurl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/',
      'set -e\n# shell\ncurl -X POST -H "Authorization: token $GITHUB_TOKEN" -d \'{"name": "test"}\' https://api.github.com/orgs/octocat/repos',
      'set -e\ncurl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/repos/octocat/test | grep -o "git@[^ ]*" | head -n 1',
      'set -e\ncurl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/repos/octocat/test',
    ];

    expect(output).toEqual(commands);
  });
});

describe('createSession', () => {
  it('should prepare for next task', () => {
    const primer = 'hello world';

    updatePrimer(primer);
    const session = createSession('input');

    expect(session).toEqual({
      messages: [
        { role: 'system', content: primer },
        { role: 'assistant', content: "Yes, I'm ready! What's the task?" },
        { role: 'user', content: 'input' },
      ],
    });
  });

  describe('readBody', () => {
    it('should read data from a stream as a promise', async () => {
      const request = new EventEmitter();
      const output = readBody(request as any);
      request.emit('data', Buffer.from('test me up'));
      request.emit('end', '');

      await expect(output).resolves.toBe('test me up');
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
    const commands = ['# shell\npwd', 'curl \\\n https://google.com/', 'cd mocks\nls', 'invalid-command-1'];
    const output = await runCommands(commands);

    expect(output).toEqual({
      ok: false,
      outputs: [
        {
          cmd: 'pwd',
          output: {
            code: 0,
            ok: true,
            stdout: process.cwd() + '\n',
            stderr: '',
            error: undefined,
          },
        },
        {
          cmd: 'curl \\\n https://google.com/',
          output: {
            code: expect.any(Number),
            ok: true,
            stdout: expect.any(String),
            stderr: '',
            error: undefined,
          },
        },
        {
          cmd: 'cd mocks\nls',
          output: {
            code: expect.any(Number),
            ok: true,
            stdout: expect.any(String),
            stderr: '',
            error: undefined,
          },
        },
        {
          cmd: 'invalid-command-1',
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
