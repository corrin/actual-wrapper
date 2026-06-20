export function deserializeActualValue(value: string): unknown {
  const type = value.slice(0, 2);
  const body = value.slice(2);

  if (type === '0:') {
    return null;
  }

  if (type === 'N:') {
    return Number(body);
  }

  if (type === 'S:') {
    return body;
  }

  return value;
}
