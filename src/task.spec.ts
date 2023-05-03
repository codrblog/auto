import { readTaskFromText } from './task';

describe('task utils', () => {
  describe('readTaskFromText', () => {
    it('reads a task with a header', () => {
      const text = `File: src/main.ts
      File: src/index.ts
      Invalid: true
      ---
      Fix the type issue:
      Argument of type 'number' is not assignable to parameter of type 'string'.ts(2345)
      `;

      const output = readTaskFromText(text);
      expect(output).toEqual({
        files: ['src/main.ts', 'src/index.ts'],
        task: `Fix the type issue:\nArgument of type 'number' is not assignable to parameter of type 'string'.ts(2345)`,
      });
    });

    it('reads a task without a header', () => {
      const text = `Fix the type issue:
      Argument of type 'number' is not assignable to parameter of type 'string'.ts(2345)`;

      const output = readTaskFromText(text);
      expect(output).toEqual({
        files: [],
        task: `Fix the type issue:\nArgument of type 'number' is not assignable to parameter of type 'string'.ts(2345)`,
      });
    });
  });
});
