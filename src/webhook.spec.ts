import { createHmac } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { fromWebhook, processWebhookEvent } from './webhook';
import * as mocks from './__tests__/webhook.mocks.js';

process.env.API_KEY = 'apiKey';
process.env.GITHUB_SECRET = 'secret';

describe('task from a github issue or comment', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockReturnValue(null);
  });

  it('should start a task from the text in an issue', async () => {
    const body = JSON.stringify(mocks.issueOpened);
    const requestSignature = 'sha1=' + createHmac('sha1', 'secret').update(Buffer.from(body)).digest('hex');
    const request = new IncomingMessage(null);
    const response = new ServerResponse(request);
    request.headers['x-hub-signature'] = requestSignature;

    const task = fromWebhook(request, response);

    request.emit('data', Buffer.from(body));
    request.emit('end');

    await expect(task).resolves.toBe(true);
    expect(response.statusCode).toBe(202);
    expect(response.writableEnded).toBe(true);
  });

  it('should reject a request if signature is invalid', async () => {
    const body = JSON.stringify(mocks.issueOpened);
    const requestSignature = 'sha1=' + createHmac('sha1', 'not-secret').update(Buffer.from(body)).digest('hex');
    const request = new IncomingMessage(null);
    const response = new ServerResponse(request);
    request.headers['x-hub-signature'] = requestSignature;

    const task = fromWebhook(request, response);

    request.emit('data', Buffer.from(body));
    request.emit('end');

    await expect(task).resolves.toBe(false);
    expect(response.statusCode).toBe(404);
    expect(response.writableEnded).toBe(true);
  });
});

describe('process a webhook event', () => {
  it('responds to an issue created', () => {
    processWebhookEvent(issueC)
  });
});
