import { IncomingMessage, ServerResponse } from 'http';
import { readBody } from './utils.js';
import {
  isIssueActionable,
  isRequestSignatureValid,
  prepareRepository,
  pushAllChanges,
  readIssueDetails,
} from './github.js';
import { removeHistory } from './history.js';
import { tryTask } from './task.js';

export async function fromWebhook(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request);

  /* istanbul ignore next */
  process.env.DEBUG && console.log(body);

  if (!isRequestSignatureValid(String(request.headers['x-hub-signature']), body)) {
    console.log('Invalid signature: ' + request.headers['x-hub-signature']);
    response.writeHead(404);
    response.end();
    return false;
  }

  response.writeHead(202);
  response.end();

  await processWebhookEvent(JSON.parse(body));

  return true;
}

export async function processWebhookEvent(event: any) {
  if (!isIssueActionable(event)) {
    return false;
  }

  const issue = readIssueDetails(event);

  if (issue.issue.state === 'closed' || event.action === 'closed') {
    removeHistory(issue.repository.fullName, issue.issue.number);
    return false;
  }

  const repository = await prepareRepository(issue.repository.fullName, issue.repository.cloneUrl);
  if (repository === false) {
    return false;
  }

  if (!issue.comment || issue.comment.body === 'retry') {
    const task = `Context:
    Next task comes from ${issue.repository.url}.
    The repository is already cloned at ${process.cwd()}/${issue.repository.fullName}
    If a task requires reading the content of files, generate only commands to read them and nothing else.
    If task is completed, post a message on issue number #${issue.issue.number} at ${issue.issue.url}.
    If you are done, commit all changes and push.

    Description:
    # ${issue.issue.title}
    ${issue.issue.text}
    `;
    await tryTask(task);
    return true;
  }

  if (issue.comment.body === 'push') {
    await pushAllChanges(issue.repository.fullName);
    return true;
  }

  const taskFromComments = `
  Context: we are completing a task from ${issue.repository.url}.
  The repository is already cloned at ${process.cwd()}/${issue.repository.fullName}.
  If task is completed, post a message on issue number #${issue.issue.number} at ${issue.issue.url}.
  When you are done, commit all changes and push.

  Description:
  # ${issue.issue.title}
  ${issue.issue.text}

  Next task:
  ${issue.comment.body}
  `;
  await tryTask(taskFromComments);
  return true;
}
