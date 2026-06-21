#!/usr/bin/env node
import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tokenPath = path.join('build', 'debug-control-token.txt');

export async function getDebugToken() {
  const envToken = process.env.ACTUAL_WRAPPER_DEBUG_TOKEN || process.env.DEBUG_TOKEN || '';
  if (envToken.trim()) {
    return envToken.trim();
  }

  try {
    const token = await readFile(tokenPath, 'utf8');
    if (token.trim()) {
      return token.trim();
    }
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error;
    }
  }

  const token = crypto.randomBytes(24).toString('hex');
  await mkdir(path.dirname(tokenPath), { recursive: true });
  await writeFile(tokenPath, `${token}\n`, { mode: 0o600 });
  return token;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(await getDebugToken());
}
