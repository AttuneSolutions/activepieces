import { IncomingMessage, Server, ServerResponse, createServer } from 'node:http';
import { ApFile } from '@activepieces/pieces-framework';
import { afterEach, describe, expect, it } from 'vitest';
import { echobackApi } from './index';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

type Recorded = {
  authorization?: string;
  contentType?: string;
  body: string;
};

const started: Server[] = [];

const startServer = async (handler: Handler): Promise<string> => {
  const server = createServer(handler);
  started.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('server did not bind a port');
  }
  return `http://127.0.0.1:${address.port}`;
};

const readBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

afterEach(async () => {
  await Promise.all(started.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe('submitJob', () => {
  it('posts the audio as multipart with the bearer token and returns the 202 body', async () => {
    const recorded: Recorded = { body: '' };
    const baseUrl = await startServer(async (request, response) => {
      recorded.authorization = request.headers['authorization'];
      recorded.contentType = request.headers['content-type'];
      recorded.body = await readBody(request);
      response.writeHead(202, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          job_id: 'b3f1c2a7',
          job_ref: 'vm-0042',
          status: 'queued',
          status_url: '/jobs/b3f1c2a7',
        })
      );
    });

    const submission = await echobackApi.submitJob({
      auth: { baseUrl: `${baseUrl}/`, apiToken: 'token-123' },
      file: new ApFile('voicemail.wav', Buffer.from('RIFFfake'), 'wav'),
      callbackUrl: 'https://automate.example.com/api/v1/flow-runs/1/requests/2',
      jobRef: 'vm-0042',
      model: 'small',
      vocabularyHint: 'Aroha, Kia ora',
    });

    expect(submission.job_id).toBe('b3f1c2a7');
    expect(recorded.authorization).toBe('Bearer token-123');
    expect(recorded.contentType).toContain('multipart/form-data; boundary=');
    expect(recorded.body).toContain('name="file"; filename="voicemail.wav"');
    expect(recorded.body).toContain('https://automate.example.com/api/v1/flow-runs/1/requests/2');
    expect(recorded.body).toContain('name="job_ref"');
    expect(recorded.body).toContain('name="model"');
    expect(recorded.body).toContain('name="vocabulary_hint"');
  });

  it('omits the optional fields when they are not supplied', async () => {
    const recorded: Recorded = { body: '' };
    const baseUrl = await startServer(async (request, response) => {
      recorded.body = await readBody(request);
      response.writeHead(202, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ job_id: 'x', job_ref: null, status: 'queued', status_url: '/jobs/x' }));
    });

    await echobackApi.submitJob({
      auth: { baseUrl, apiToken: 'token-123' },
      file: new ApFile('voicemail.wav', Buffer.from('RIFFfake')),
      callbackUrl: 'https://automate.example.com/x',
    });

    expect(recorded.body).not.toContain('name="job_ref"');
    expect(recorded.body).not.toContain('name="model"');
    expect(recorded.body).not.toContain('name="vocabulary_hint"');
  });

  it('fails with the echoback code and message when the submission is rejected', async () => {
    const baseUrl = await startServer((_request, response) => {
      response.writeHead(413, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          error: { code: 'PAYLOAD_TOO_LARGE', message: 'file exceeds MAX_UPLOAD_MB' },
        })
      );
    });

    await expect(
      echobackApi.submitJob({
        auth: { baseUrl, apiToken: 'token-123' },
        file: new ApFile('voicemail.wav', Buffer.from('RIFFfake')),
        callbackUrl: 'https://automate.example.com/x',
      })
    ).rejects.toThrow('HTTP 413: PAYLOAD_TOO_LARGE — file exceeds MAX_UPLOAD_MB');
  });

  it('refuses to submit a loopback callback URL before touching the network', async () => {
    await expect(
      echobackApi.submitJob({
        auth: { baseUrl: 'http://127.0.0.1:1', apiToken: 'token-123' },
        file: new ApFile('voicemail.wav', Buffer.from('RIFFfake')),
        callbackUrl: 'http://localhost:4200/api/v1/flow-runs/1/requests/2',
      })
    ).rejects.toThrow('AP_FRONTEND_URL');
  });
});

describe('fetchJob', () => {
  it('fetches the job over the authenticated API', async () => {
    const recorded: { url?: string; authorization?: string } = {};
    const baseUrl = await startServer((request, response) => {
      recorded.url = request.url;
      recorded.authorization = request.headers['authorization'];
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ job_id: 'b3f1/c2a7', status: 'transcribed', text: 'Kia ora' }));
    });

    const job = await echobackApi.fetchJob({
      auth: { baseUrl, apiToken: 'token-123' },
      jobId: 'b3f1/c2a7',
    });

    expect(job.text).toBe('Kia ora');
    expect(recorded.url).toBe('/jobs/b3f1%2Fc2a7');
    expect(recorded.authorization).toBe('Bearer token-123');
  });

  it('surfaces a purged job as NOT_FOUND', async () => {
    const baseUrl = await startServer((_request, response) => {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'job is unknown or purged' } }));
    });

    await expect(
      echobackApi.fetchJob({ auth: { baseUrl, apiToken: 'token-123' }, jobId: 'gone' })
    ).rejects.toThrow('HTTP 404: NOT_FOUND — job is unknown or purged');
  });
});

describe('checkHealth', () => {
  it('reports a reachable service as valid', async () => {
    const baseUrl = await startServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
    });

    expect(await echobackApi.checkHealth(baseUrl)).toEqual({ valid: true });
  });

  it('reports an unreachable service as invalid', async () => {
    const result = await echobackApi.checkHealth('http://127.0.0.1:1');
    expect(result.valid).toBe(false);
  });
});
