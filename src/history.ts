import { ChatCompletionRequestMessage } from 'openai';

const cache = new Map();

export function getHistory(repo: string, issueNumber: number) {
  const key = getKey(repo, issueNumber);
  return cache.get(key) || [];
}

export function removeHistory(repo: string, issueNumber: number) {
  const key = getKey(repo, issueNumber);
  return cache.delete(key);
}

export function addHistory(repo: string, issueNumber: number, messages: ChatCompletionRequestMessage[]) {
  const history = getHistory(repo, issueNumber);
  const key = getKey(repo, issueNumber);
  cache.set(key, history.concat(messages));
}

function getKey(a, b) {
  return a + b;
}
