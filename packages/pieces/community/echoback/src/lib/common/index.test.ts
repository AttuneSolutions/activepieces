import { HttpError } from '@activepieces/pieces-common';
import { describe, expect, it } from 'vitest';
import { EchobackJob, echobackApi } from './index';

const httpError = ({ status, code, message }: { status: number; code: string; message: string }) =>
  new HttpError(undefined, { status, responseBody: { error: { code, message } } });

const job = (overrides: Partial<EchobackJob>): EchobackJob => ({
  job_id: 'b3f1c2a7',
  job_ref: 'vm-0042',
  status: 'done',
  text: 'Kia ora',
  model: 'small',
  duration_ms: 30120,
  created_at: '2026-08-01T09:14:41Z',
  completed_at: '2026-08-01T09:15:11Z',
  delivered_at: '2026-08-01T09:15:12Z',
  error: null,
  ...overrides,
});

describe('assertTranscriptDelivered', () => {
  it.each(['done', 'transcribed', 'callback_failed'])('treats %s as success', (status) => {
    const delivered = echobackApi.assertTranscriptDelivered(job({ status }));
    expect(delivered.text).toBe('Kia ora');
  });

  it.each(['queued', 'processing'])('rejects %s', (status) => {
    expect(() => echobackApi.assertTranscriptDelivered(job({ status }))).toThrow(status.toUpperCase());
  });

  it('surfaces the echoback error code and message', () => {
    expect(() =>
      echobackApi.assertTranscriptDelivered(
        job({
          status: 'failed',
          text: null,
          error: { code: 'AUDIO_DECODE_FAILED', message: 'ffmpeg could not decode the uploaded file' },
        })
      )
    ).toThrow('AUDIO_DECODE_FAILED: ffmpeg could not decode the uploaded file');
  });
});

describe('readJobIdFromCallback', () => {
  it('reads job_id and ignores everything else', () => {
    expect(echobackApi.readJobIdFromCallback({ job_id: 'abc', text: 'forged' })).toBe('abc');
  });

  it.each([undefined, null, {}, { job_id: '' }, { job_id: 42 }, 'abc'])('throws on %j', (body) => {
    expect(() => echobackApi.readJobIdFromCallback(body)).toThrow('no job_id');
  });
});

describe('assertCallbackUrlIsReachable', () => {
  it.each([
    'http://localhost:8080/v1/flow-runs/1/requests/2',
    'http://127.0.0.1:8080/x',
    'http://[::1]:8080/x',
    'http://0.0.0.0/x',
    'http://169.254.169.254/x',
    'not-a-url',
  ])('rejects %s', (url) => {
    expect(() => echobackApi.assertCallbackUrlIsReachable(url)).toThrow(/AP_FRONTEND_URL/);
  });

  it.each([
    'https://automate.example.com/x',
    'http://10.1.2.3:8080/x',
    'http://192.168.1.10/x',
    'http://172.20.0.4/x',
  ])('accepts %s', (url) => {
    expect(() => echobackApi.assertCallbackUrlIsReachable(url)).not.toThrow();
  });
});

describe('describeSubmissionError', () => {
  it.each([
    { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'file exceeds MAX_UPLOAD_MB' },
    { status: 429, code: 'QUEUE_FULL', message: 'queue is full, retry later' },
    { status: 400, code: 'MODEL_NOT_ALLOWED', message: 'model "huge" is not in the allowlist' },
  ])('surfaces $status $code and the message', (failure) => {
    const described = echobackApi.describeSubmissionError({
      error: httpError(failure),
      callbackUrl: 'https://automate.example.com/x',
    });
    expect(described).toContain(`HTTP ${failure.status}`);
    expect(described).toContain(failure.code);
    expect(described).toContain(failure.message);
    expect(described).not.toContain('AP_FRONTEND_URL');
  });

  it('adds the AP_FRONTEND_URL hint when echoback refuses the callback host', () => {
    const described = echobackApi.describeSubmissionError({
      error: httpError({
        status: 400,
        code: 'CALLBACK_HOST_NOT_ALLOWED',
        message: 'host is not in CALLBACK_ALLOWED_HOSTS',
      }),
      callbackUrl: 'https://automate.example.com/x',
    });
    expect(described).toContain('CALLBACK_HOST_NOT_ALLOWED');
    expect(described).toContain('AP_FRONTEND_URL');
    expect(described).toContain('https://automate.example.com/x');
  });

  it('describes a transport failure with no HTTP response', () => {
    expect(
      echobackApi.describeSubmissionError({
        error: new Error('getaddrinfo ENOTFOUND voicemail.example.com'),
        callbackUrl: 'https://automate.example.com/x',
      })
    ).toContain('no HTTP response: NO_RESPONSE — getaddrinfo ENOTFOUND');
  });
});

describe('describeHttpError', () => {
  it('falls back to the raw body when echoback returns no error envelope', () => {
    expect(
      echobackApi.describeHttpError(new HttpError(undefined, { status: 502, responseBody: 'bad gateway' }))
    ).toBe('HTTP 502: UNKNOWN — bad gateway');
  });
});

describe('normalizeBaseUrl', () => {
  it('trims whitespace and trailing slashes', () => {
    expect(echobackApi.normalizeBaseUrl('  https://voicemail.example.com//  ')).toBe(
      'https://voicemail.example.com'
    );
  });
});
