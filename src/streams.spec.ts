import { ServerResponse, IncomingMessage } from 'http';
import { addStream, completeStream, sendEvent } from './streams';

describe('server sent event stream', () => {
  it('should send an event to a stream', () => {
    const stream = new ServerResponse(new IncomingMessage(null));
    createStream('123');
    addStream('123', stream);
    expect(stream.getHeader('Content-Type')).toBe('text/event-stream');
    expect(stream.getHeader('Cache-Control')).toBe('no-cache');
    expect(stream.statusCode).toBe(200);

    expect(sendEvent('987', 'test', { foo: true })).toBe(false);
    expect(sendEvent('123', 'test', { foo: true })).toBe(true);
    completeStream('123');

    expect(stream.writableEnded).toBe(true);
  });
});
