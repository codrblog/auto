import { createHmac } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { fromWebhook } from './webhook';
import * as mocks from './__tests__/webhook.mocks.js';

describe('task from a github issue or comment', () => {
  it('should start a task from the text in an issue', async () => {
    process.env.API_KEY = 'apiKey';
    const body = JSON.stringify(mocks.issueOpened);
    const requestSignature = 'sha1=' + createHmac('sha1', 'secret').update(Buffer.from(body)).digest('hex');
    const request = new IncomingMessage(null);
    const response = new ServerResponse(request);
    request.headers['x-hub-signature'] = requestSignature;

    const task = fromWebhook(request, response);

    request.emit('data', body);
    request.emit('end');

    await expect(task).resolves.toBe(true);
  });
});
