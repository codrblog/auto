import { ServerResponse } from 'http';

const streams = new Map();

export function sendEvent(uid: string, eventName: string, data: any) {
  if (!streams.has(uid)) {
    return false;
  }

  const group = streams.get(uid);
  group.streams.forEach(s => {
    s.write('event: ' + eventName + '\n');
    s.write('data: ' + JSON.stringify(data) + '\n\n');
  });

  return true;
}

export function createStream(uid: string) {
  streams.set(uid, { streams: [] });
}

export function addStream(uid: string, stream: ServerResponse) {
  streams.set(uid, stream);
  stream.setHeader('Content-Type', 'text/event-stream');
  stream.setHeader('Cache-Control', 'no-cache');
  stream.writeHead(200);

  const removeStream = () => {
    const s = streams.get(uid);
    s.streams = s.streams.filter(next => next !== stream);
  };

  stream.on('close', removeStream);
  stream.on('error', removeStream);
}

export function completeStream(uid: string) {
  streams.get(uid)?.end();
  streams.delete(uid);
}
