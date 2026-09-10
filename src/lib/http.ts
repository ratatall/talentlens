export async function readBody(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new Error('Cross-origin requests are not allowed.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Request body is required.');
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > 16000) { await reader.cancel(); throw new Error('Request is too large.'); } chunks.push(value); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
