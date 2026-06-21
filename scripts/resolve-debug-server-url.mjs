#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { getDebugToken } from './debug-token.mjs';

const required = process.argv.includes('--required');
const configured =
  process.env.ACTUAL_WRAPPER_DEBUG_SERVER_URL ||
  process.env.DEBUG_SERVER_URL ||
  (await readNgrokConfigUrl()) ||
  (await readNgrokApiUrl());

if (!configured) {
  if (required) {
    throw new Error(
      'No debug server URL found. Set ACTUAL_WRAPPER_DEBUG_SERVER_URL, create ngrok.yml with a domain, or start ngrok before deploying.',
    );
  }
  process.exit(0);
}

console.log(await normalizeWebSocketUrl(configured));

async function readNgrokConfigUrl() {
  try {
    const config = await readFile('ngrok.yml', 'utf8');
    const domain = config.match(/^\s*domain:\s*([^\s#]+)/m)?.[1];
    if (domain) {
      return `https://${domain}`;
    }

    const url = config.match(/^\s*url:\s*([^\s#]+)/m)?.[1];
    return url || '';
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

async function readNgrokApiUrl() {
  const apiUrl = process.env.NGROK_API_URL || 'http://127.0.0.1:4040/api/tunnels';

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return '';
    }

    const body = await response.json();
    const tunnel = body.tunnels?.find(candidate => {
      return (
        candidate &&
        typeof candidate.public_url === 'string' &&
        candidate.public_url.startsWith('https://')
      );
    });

    return tunnel?.public_url || '';
  } catch {
    return '';
  }
}

async function normalizeWebSocketUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol === 'https:') {
    parsed.protocol = 'wss:';
  } else if (parsed.protocol === 'http:') {
    parsed.protocol = 'ws:';
  } else if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
    throw new Error(`Debug server URL must use http(s) or ws(s): ${value}`);
  }

  parsed.pathname = '/ws';
  parsed.searchParams.set('token', await getDebugToken());
  parsed.hash = '';
  return parsed.toString();
}
