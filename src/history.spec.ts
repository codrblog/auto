import { ChatCompletionRequestMessage } from 'openai';
import { getHistory, addHistory, removeHistory } from './history';

describe('history by repo and issue', () => {
  it('should return an empty array', () => {
    expect(getHistory('foo/bar', 1)).toEqual([]);
  });

  it('should manage chat history', () => {
    const messages: ChatCompletionRequestMessage[] = [
      { role: 'user', content: 'foo' },
      { role: 'assistant', content: 'bar' },
    ];

    addHistory('foo/bar', 2, messages);
    addHistory('foo/bar', 2, [{ role: 'assistant', content: 'other' }]);

    expect(getHistory('foo/bar', 2)).toEqual([...messages, { role: 'assistant', content: 'other' }]);

    removeHistory('foo/bar', 2);
    expect(getHistory('foo/bar', 2)).toEqual([]);
  });
});
