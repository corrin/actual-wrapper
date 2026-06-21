#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { getDebugToken } from './debug-token.mjs';

const port = Number(process.env.DEBUG_PORT || process.env.PORT || 35561);
const apiUrl = process.env.NGROK_API_URL || 'http://127.0.0.1:4040/api/tunnels';
const explicitDomain = process.env.ACTUAL_WRAPPER_NGROK_DOMAIN || process.env.NGROK_DOMAIN || '';

const ngrok = await resolveNgrok();
const hasConfig = await fileExists('ngrok.yml');
const args = hasConfig
  ? ['start', '--config', 'ngrok.yml', '--all']
  : ['http', String(port), '--log', 'stdout'];
if (!hasConfig && explicitDomain) {
  args.push('--url', explicitDomain);
}

console.log(`Starting Actual Wrapper ngrok tunnel: ${ngrok} ${args.join(' ')}`);
let ready = false;
const child = spawn(ngrok, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', chunk => {
  process.stdout.write(chunk);
});
child.stderr.on('data', chunk => {
  process.stderr.write(chunk);
});

child.on('exit', (code, signal) => {
  if (!ready) {
    console.error(`ngrok exited before the tunnel was ready: ${signal || code}`);
    process.exit(typeof code === 'number' ? code : 1);
  }
  process.exit(typeof code === 'number' ? code : 0);
});

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

const publicUrl = await waitForTunnel();
ready = true;
const debugToken = await getDebugToken();

const tunnel = new URL(publicUrl);
tunnel.protocol = 'wss:';
tunnel.pathname = '/ws';
tunnel.searchParams.set('token', debugToken);
tunnel.hash = '';

const ui = new URL(publicUrl);
ui.pathname = '/';
ui.searchParams.set('token', debugToken);
ui.hash = '';

console.log('Actual Wrapper ngrok tunnel ready');
console.log(`UI: ${ui.toString()}`);
console.log(`Phone WebSocket URL: ${tunnel.toString()}`);

function stop(signal) {
  child.kill(signal);
  setTimeout(() => process.exit(0), 1000).unref();
}

async function resolveNgrok() {
  if (process.env.NGROK_BIN) {
    return process.env.NGROK_BIN;
  }

  const candidates = ['/snap/ngrok/current/ngrok', 'ngrok'];
  for (const candidate of candidates) {
    if (candidate.includes('/')) {
      try {
        await access(candidate);
        return candidate;
      } catch {
        continue;
      }
    }
    return candidate;
  }

  return 'ngrok';
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function waitForTunnel() {
  let lastError = '';
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await delay(500);

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        lastError = `${response.status} ${response.statusText}`;
        continue;
      }

      const body = await response.json();
      const tunnel = body.tunnels?.find(candidate => {
        return (
          candidate &&
          typeof candidate.public_url === 'string' &&
          candidate.public_url.startsWith('https://')
        );
      });

      if (tunnel) {
        return tunnel.public_url.replace(/\/+$/, '');
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  child.kill('SIGTERM');
  throw new Error(`Timed out waiting for ngrok tunnel at ${apiUrl}: ${lastError}`);
}

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
