import { createWriteStream } from 'fs';

let file = createWriteStream(process.env.APP_LOGS);

function write(type: string, line: string) {
  const time = timestamp();
  const str = line
    .split('\n')
    .map((s) => `[${type}] [${time}] ${s}`)
    .join('\n');

  file.write(str + '\n');
}

process.on('exit', () => file.close());

function log(line: string) {
  write('I', line);
}

function error(line: string) {
  write('E', line);
}

function timestamp() {
  return new Date().toISOString().slice(0, 19);
}

export default { log, error };
