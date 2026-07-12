import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import test from 'node:test';

import { startServer } from '../src/node/server.mjs';

test('serves Studio from the local server', async (context) => {
  const server = await startServer({ port: 0, host: '127.0.0.1' });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/web/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /ReadmePort Studio/);
});

test('does not serve hidden repository metadata', async (context) => {
  const server = await startServer({ port: 0, host: '127.0.0.1' });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/.git/config`);
  assert.equal(response.status, 403);
});

test('redirects the root to the Studio directory', async (context) => {
  const server = await startServer({ port: 0, host: '127.0.0.1' });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/web/');
});

test('rejects malformed percent-encoded paths without stopping the server', async (context) => {
  const server = await startServer({ port: 0, host: '127.0.0.1' });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const malformed = await fetch(`http://127.0.0.1:${port}/%E0%A4%A`);
  assert.equal(malformed.status, 400);
  const healthy = await fetch(`http://127.0.0.1:${port}/web/`);
  assert.equal(healthy.status, 200);
});

test('rejects a malformed absolute request target without stopping the server', async (context) => {
  const server = await startServer({ port: 0, host: '127.0.0.1' });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const response = await new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port }, () => {
      socket.write('GET http://[ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
    });
    let received = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => { received += chunk; });
    socket.on('end', () => resolve(received));
    socket.on('error', reject);
  });
  assert.match(response, /400 Bad Request/);
  const healthy = await fetch(`http://127.0.0.1:${port}/web/`);
  assert.equal(healthy.status, 200);
});
