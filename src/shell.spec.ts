import { runCommands } from './shell.js';

describe('run shell commands', () => {
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
