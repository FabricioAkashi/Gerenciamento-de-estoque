import { PassThrough } from 'node:stream';
import http from 'node:http';

/**
 * Executa uma requisicao HTTP simulada em memoria contra uma instancia Express,
 * sem abrir portas TCP nem depender de rede.
 */
export function invokeApp(app, { method = 'GET', url = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const rawBody = body !== null && body !== undefined
      ? (typeof body === 'string' ? body : JSON.stringify(body))
      : null;

    const normalizedHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      normalizedHeaders[key.toLowerCase()] = value;
    }

    if (rawBody !== null) {
      normalizedHeaders['content-type'] ??= 'application/json';
      normalizedHeaders['content-length'] = String(Buffer.byteLength(rawBody));
    }

    const reqSocket = new PassThrough();
    reqSocket.remoteAddress = '127.0.0.1';
    reqSocket.encrypted = false;

    const req = new http.IncomingMessage(reqSocket);
    req.method = method.toUpperCase();
    req.url = url;
    req.headers = normalizedHeaders;
    req.httpVersion = '1.1';
    req.httpVersionMajor = 1;
    req.httpVersionMinor = 1;

    if (rawBody !== null) {
      req.push(rawBody);
    }
    req.push(null);

    const chunks = [];
    const resSocket = new PassThrough();
    resSocket.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    const res = new http.ServerResponse(req);
    res.assignSocket(resSocket);

    res.on('finish', () => {
      const rawResponse = Buffer.concat(chunks).toString('utf8');
      const headerSplitIndex = rawResponse.indexOf('\r\n\r\n');
      const rawTextBody = headerSplitIndex >= 0 ? rawResponse.slice(headerSplitIndex + 4) : rawResponse;

      let parsedBody = rawTextBody;
      const contentType = String(res.getHeader('content-type') || '');
      if (contentType.includes('application/json') && rawTextBody) {
        try {
          parsedBody = JSON.parse(rawTextBody);
        } catch {
          parsedBody = rawTextBody;
        }
      }

      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsedBody
      });
    });

    res.on('error', reject);

    try {
      app(req, res);
    } catch (err) {
      reject(err);
    }
  });
}
