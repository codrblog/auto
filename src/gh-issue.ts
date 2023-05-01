import { createHmac } from 'crypto';
import { runCommands } from './utils.js';
import { existsSync } from 'fs';
import { join } from 'path';
import type { EmitterWebhookEvent } from '@octokit/webhooks';

export type IssueOpened = EmitterWebhookEvent<'issues.opened'>['payload'];
export type IssueEdited = EmitterWebhookEvent<'issues.edited'>['payload'];
export type CommentCreated = EmitterWebhookEvent<'issue_comment.created'>['payload'];

const [authorizedUsers, authorizedOrgs] = [process.env.APP_USERS, process.env.APP_ORGS].map((s) =>
  s
    .split(',')
    .filter(Boolean)
    .map((s) => s.trim()),
);

export function isRequestSignatureValid(requestSignature: string, body: string) {
  const payloadSignature = 'sha1=' + createHmac('sha1', process.env.GITHUB_SECRET).update(body).digest('hex');
  return payloadSignature === requestSignature;
}

export const isIssueActionable = (
  event: IssueOpened | IssueEdited | CommentCreated,
): event is IssueOpened | IssueEdited | CommentCreated => {
  if (!event.issue) {
    return false;
  }

  const validOrgAndOpen = event.issue.state === 'open' && authorizedOrgs.includes(event.organization.login);
  const validIssue = ['opened', 'edited'].includes(event.action) && authorizedUsers.includes(event.issue.user.login);
  const validComment =
    ['created'].includes(event.action) && authorizedUsers.includes((event as CommentCreated).comment.user.login);

  return validOrgAndOpen && (validIssue || validComment);
};

export const readIssueDetails = (event: IssueOpened | IssueEdited | CommentCreated) => {
  const comment = 'comment' in event ? (event as CommentCreated).comment : null;

  return {
    issue: {
      id: event.issue.id,
      number: event.issue.number,
      title: event.issue.title,
      text: event.issue.body.replace(/\r\n/g, '\n'),
      url: event.issue.html_url,
    },
    repository: {
      name: event.repository.name,
      fullName: event.repository.full_name,
      url: event.repository.html_url,
      cloneUrl: `https://codrblog:$GITHUB_TOKEN@github.com/${event.repository.full_name}.git`,
    },
    comment: !comment ? null : { body: comment.body },
  };
};

export type Issue = ReturnType<typeof readIssueDetails>;

export async function prepareRepository(name: string, cloneUrl: string) {
  const commands = [];
  const [org, repo] = name.split('/');

  if (!existsSync(join(process.cwd(), org))) {
    commands.push('mkdir ' + org);
  }

  if (!existsSync(join(process.cwd(), name))) {
    commands.push(`cd ${org} && git clone ${cloneUrl} ${repo}`);
  } else {
    commands.push(`cd ${name} && git pull --rebase --autostash`);
  }

  const clone = await runCommands(commands);
  if (!clone.ok) {
    console.error('Failed to clone ' + cloneUrl, clone);
    return false;
  }
}

export async function pushAllChanges(name: string) {
  return runCommands([
    `cd ${join(process.cwd(), name)} && git add . && git commit -m 'chore: push all changes' && git push`,
  ]);
}
