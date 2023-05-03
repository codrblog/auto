import { ServerResponse } from 'http';

const streams = new Map();

export function sendEvent(uid: string, eventName: string, data: any) {
  if (!streams.has(uid)) {
    return false;
  }

  const stream = streams.get(uid);
  stream.write('event: ' + eventName + '\n');
  stream.write('data: ' + JSON.stringify(data) + '\n\n');

  return true;
}

export function addStream(uid: string, stream: ServerResponse) {
  streams.set(uid, stream);
  stream.setHeader('Content-Type', 'text/event-stream');
  stream.setHeader('Cache-Control', 'no-cache');
  stream.writeHead(200);
}

export function completeStream(uid: string) {
  streams.get(uid)?.end();
  streams.delete(uid);
}
