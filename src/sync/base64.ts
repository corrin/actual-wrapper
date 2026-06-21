const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(input: string): Uint8Array {
  const cleaned = input.replace(/\s+/g, '');
  if (cleaned.length % 4 === 1) {
    throw new Error('Invalid base64 value.');
  }

  let buffer = 0;
  let bits = 0;
  const bytes: number[] = [];

  for (const char of cleaned.replace(/=+$/, '')) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) {
      throw new Error('Invalid base64 value.');
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

