#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const url = process.argv[2] || '';
const destination = path.join('src', 'debug', 'generatedDebugServerUrl.ts');

if (url && !/^wss?:\/\/[^/]+\/ws$/.test(url)) {
  throw new Error(`Debug server URL must look like ws(s)://host/ws: ${url}`);
}

await mkdir(path.dirname(destination), { recursive: true });
await writeFile(
  destination,
  `export const GENERATED_DEBUG_SERVER_URL = ${JSON.stringify(url)};\n`,
);

console.log(url ? `Embedded debug server URL: ${url}` : 'Cleared embedded debug server URL.');
