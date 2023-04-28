import { createWriteStream, statSync } from 'fs';

const logFilePath = process.env.APP_LOGS;

let file: any;

if (logFilePath) {
  const stat = statSync(logFilePath, { throwIfNoEntry: false });
  file = createWriteStream(logFilePath, { start: stat?.isFile() ? stat.size : 0 });
}

function write(type: string, line: string) {
  const time = timestamp();
  const str = line
    .split('\n')
    .map((s) => `[${type}] [${time}] ${s}`)
    .join('\n');

  file?.write(str + '\n');
  process.stdout.write(str + '\n');
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
