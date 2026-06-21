#!/usr/bin/env node
import crypto from 'node:crypto';
import http from 'node:http';
import os from 'node:os';

const port = Number(process.env.DEBUG_PORT || process.env.PORT || 35561);
const host = process.env.DEBUG_HOST || '0.0.0.0';
const phoneClients = new Set();
const sseClients = new Set();
const recentEvents = [];

function pushEvent(event) {
  const entry = {
    ...event,
    receivedAt: new Date().toISOString(),
  };
  recentEvents.push(entry);
  recentEvents.splice(0, Math.max(0, recentEvents.length - 300));
  broadcastSse('event', entry);
}

function broadcastSse(type, payload) {
  const line = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of sseClients) {
    response.write(line);
  }
}

function sendWs(socket, payload) {
  socket.write(encodeWsFrame(JSON.stringify(payload)));
}

function sendCommand(type, payload = {}) {
  const id = crypto.randomUUID();
  const command = { id, payload, type };
  const connectedClients = phoneClients.size;
  for (const socket of phoneClients) {
    sendWs(socket, command);
  }
  pushEvent({
    direction: 'server-to-phone',
    message: connectedClients > 0 ? 'command sent' : 'no phone connected',
    payload: { command, connectedClients },
  });
  return { ...command, connectedClients };
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(renderPage());
    return;
  }

  if (request.method === 'GET' && url.pathname === '/events') {
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
    });
    sseClients.add(response);
    response.write(`event: snapshot\ndata: ${JSON.stringify(recentEvents)}\n\n`);
    request.on('close', () => {
      sseClients.delete(response);
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/command') {
    readJson(request)
      .then(body => {
        const type = typeof body.type === 'string' ? body.type : '';
        if (!type) {
          response.writeHead(400);
          response.end('Missing command type.');
          return;
        }

        const command = sendCommand(
          type,
          body.payload && typeof body.payload === 'object' ? body.payload : {},
        );
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(command));
      })
      .catch(error => {
        response.writeHead(400);
        response.end(error instanceof Error ? error.message : String(error));
      });
    return;
  }

  response.writeHead(404);
  response.end('Not found.');
});

server.on('upgrade', (request, socket) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const key = request.headers['sec-websocket-key'];
  if (typeof key !== 'string') {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');

  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n',
    ].join('\r\n'),
  );

  phoneClients.add(socket);
  socket.wsBuffer = Buffer.alloc(0);
  pushEvent({ direction: 'phone', message: 'connected' });

  socket.on('data', chunk => {
    const decoded = decodeWsFrames(Buffer.concat([socket.wsBuffer, chunk]));
    socket.wsBuffer = decoded.remaining;
    for (const message of decoded.messages) {
      try {
        pushEvent({ direction: 'phone-to-server', payload: JSON.parse(message) });
      } catch {
        pushEvent({ direction: 'phone-to-server', payload: message });
      }
    }
  });

  socket.on('close', () => {
    phoneClients.delete(socket);
    pushEvent({ direction: 'phone', message: 'disconnected' });
  });
});

server.listen(port, host, () => {
  console.log(`Actual Wrapper debug server listening on ws://${bestLanAddress()}:${port}/ws`);
  console.log(`UI: http://${bestLanAddress()}:${port}/`);
});

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON.'));
      }
    });
  });
}

function encodeWsFrame(text) {
  const payload = Buffer.from(text);
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  }
  if (payload.length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

function decodeWsFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const frameStart = offset;
    const opcode = buffer[offset] & 0x0f;
    const masked = Boolean(buffer[offset + 1] & 0x80);
    let length = buffer[offset + 1] & 0x7f;
    offset += 2;

    if (length === 126) {
      if (offset + 2 > buffer.length) {
        offset = frameStart;
        break;
      }
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (offset + 8 > buffer.length) {
        offset = frameStart;
        break;
      }
      length = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    let mask = null;
    if (masked) {
      if (offset + 4 > buffer.length) {
        offset = frameStart;
        break;
      }
      mask = buffer.subarray(offset, offset + 4);
      offset += 4;
    }

    if (offset + length > buffer.length) {
      offset = frameStart;
      break;
    }
    const payload = Buffer.from(buffer.subarray(offset, offset + length));
    offset += length;

    if (mask) {
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4];
      }
    }

    if (opcode === 0x8) {
      continue;
    }
    if (opcode === 0x1) {
      messages.push(payload.toString('utf8'));
    }
  }
  return {
    messages,
    remaining: buffer.subarray(offset),
  };
}

function bestLanAddress() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return '127.0.0.1';
}

function renderPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Actual Wrapper Debug</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 20px; background: #f8fafc; color: #0f172a; }
    button, input { font: inherit; margin: 4px; padding: 8px 10px; }
    pre { background: #0f172a; color: #e2e8f0; min-height: 55vh; overflow: auto; padding: 12px; white-space: pre-wrap; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>Actual Wrapper Debug</h1>
  <div class="row">
    <button data-command="get-state">Get state</button>
    <button data-command="clear-diagnostics">Clear diagnostics</button>
    <button data-command="reload-webview">Reload WebView</button>
    <button data-command="reset-setup">Reset setup</button>
    <button data-command="test-notification">Test notification</button>
    <button id="badge">Set badge</button>
    <button id="navigate">Navigate WebView</button>
    <button data-command="run-auth-probe">Auth probe</button>
  </div>
  <pre id="log"></pre>
  <script>
    const log = document.getElementById('log');
    function append(value) {
      log.textContent += JSON.stringify(value, null, 2) + '\\n';
      log.scrollTop = log.scrollHeight;
    }
    async function send(type, payload) {
      const response = await fetch('/command', {
        body: JSON.stringify({ type, payload }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST'
      });
      append({ command: type, response: await response.text() });
    }
    for (const button of document.querySelectorAll('[data-command]')) {
      button.addEventListener('click', () => send(button.dataset.command, {}));
    }
    document.getElementById('badge').addEventListener('click', () => {
      const count = Number(prompt('Badge count', '1'));
      if (!Number.isNaN(count)) send('set-badge', { count });
    });
    document.getElementById('navigate').addEventListener('click', () => {
      const url = prompt('WebView URL');
      if (url) send('navigate-webview', { url });
    });
    const events = new EventSource('/events');
    events.addEventListener('snapshot', event => append({ snapshot: JSON.parse(event.data) }));
    events.addEventListener('event', event => append(JSON.parse(event.data)));
  </script>
</body>
</html>`;
}
