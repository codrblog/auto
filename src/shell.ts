import { ExecOutput, execString } from '@cloud-cli/exec';

export async function runCommands(commands: string[]) {
  const outputs: Array<{ cmd: string; output: ExecOutput }> = [];
  let ok = true;

  for (const cmd of commands) {
    const line = sanitizeCommand(cmd);
    const sh = await execString(line);
    outputs.push({ cmd: line, output: sh });

    if (!sh.ok && sh.code === 0) {
      sh.ok = true;
      sh.stderr = '';
      sh.error = undefined;
    }

    if (!sh.ok && sh.code !== 0) {
      ok = false;
      break;
    }
  }

  return { ok, outputs };
}

function sanitizeCommand(cmd) {
  return cmd
    .split('\n')
    .filter((s) => !s.startsWith('#'))
    .join('\n');
}
