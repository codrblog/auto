import { readFileSync } from 'fs';
import { findCodeBlocks, readBody } from './utils.js';
import { EventEmitter } from 'events';

const responseText = readFileSync('./src/__tests__/response-sh.txt', 'utf8');

process.env.APP_LOGS = process.cwd() + '/log.txt';

describe('readBody', () => {
  it('should read data from a stream as a promise', async () => {
    const request = new EventEmitter();
    const output = readBody(request as any);
    request.emit('data', Buffer.from('test me up'));
    request.emit('end', '');

    await expect(output).resolves.toBe('test me up');
  });
});

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
