import { createHmac } from 'crypto';

export function isRequestSignatureValid(requestSignature: string, body: string) {
  const payloadSignature = 'sha1=' + createHmac('sha1', process.env.GITHUB_SECRET).update(body).digest('hex');
  return payloadSignature === requestSignature;
}

export const isIssueActionable = (event) => {
  return (
    ['opened', 'edited'].includes(event.action) &&
    event.issue.state === 'open' &&
    event.sender.login === 'darlanalves' &&
    event.organization.login === 'codrblog'
  );
};

export const readIssueDetails = (event) => {
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
  };
};
