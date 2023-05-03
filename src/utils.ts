import { IncomingMessage } from 'http';

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

export async function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: any[] = [];
    request.on('data', (c) => chunks.push(c));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
