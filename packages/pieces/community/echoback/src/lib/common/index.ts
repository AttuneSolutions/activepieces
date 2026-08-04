import { HttpError, HttpMethod, httpClient } from '@activepieces/pieces-common';
import { ApFile, tryCatch } from '@activepieces/pieces-framework';
import FormData from 'form-data';

async function submitJob({
  auth,
  file,
  callbackUrl,
  jobRef,
  model,
  vocabularyHint,
}: SubmitJobParams): Promise<EchobackSubmission> {
  assertCallbackUrlIsReachable(callbackUrl);

  const form = new FormData();
  form.append('file', file.data, { filename: file.filename });
  form.append('callback_url', callbackUrl);
  if (jobRef) {
    form.append('job_ref', jobRef);
  }
  if (model) {
    form.append('model', model);
  }
  if (vocabularyHint) {
    form.append('vocabulary_hint', vocabularyHint);
  }

  const result = await tryCatch(() =>
    httpClient.sendRequest<EchobackSubmission>({
      method: HttpMethod.POST,
      url: `${normalizeBaseUrl(auth.baseUrl)}/jobs`,
      headers: {
        Authorization: `Bearer ${auth.apiToken}`,
        ...form.getHeaders(),
      },
      body: form.getBuffer(),
    })
  );

  if (result.error) {
    throw new Error(describeSubmissionError({ error: result.error, callbackUrl }));
  }
  return result.data.body;
}

async function fetchJob({ auth, jobId }: FetchJobParams): Promise<EchobackJob> {
  const result = await tryCatch(() =>
    httpClient.sendRequest<EchobackJob>({
      method: HttpMethod.GET,
      url: `${normalizeBaseUrl(auth.baseUrl)}/jobs/${encodeURIComponent(jobId)}`,
      headers: { Authorization: `Bearer ${auth.apiToken}` },
    })
  );

  if (result.error) {
    throw new Error(`echoback could not return job ${jobId} — ${describeHttpError(result.error)}`);
  }
  return result.data.body;
}

async function checkHealth(baseUrl: string): Promise<{ valid: true } | { valid: false; error: string }> {
  const result = await tryCatch(() =>
    httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${normalizeBaseUrl(baseUrl)}/health`,
    })
  );
  if (result.error) {
    return {
      valid: false,
      error: `Could not reach echoback at ${normalizeBaseUrl(baseUrl)} — ${describeHttpError(
        result.error
      )}`,
    };
  }
  return { valid: true };
}

function readJobIdFromCallback(body: unknown): string {
  const jobId = isRecord(body) ? body['job_id'] : undefined;
  if (typeof jobId !== 'string' || jobId.length === 0) {
    throw new Error(
      'The resume request carried no job_id, so there is nothing to fetch from echoback. Only echoback should be calling this resume URL.'
    );
  }
  return jobId;
}

function assertTranscriptDelivered(job: EchobackJob): EchobackJob {
  if (SUCCESS_STATUSES.includes(job.status)) {
    return job;
  }
  const code = job.error?.code ?? job.status.toUpperCase();
  const message = job.error?.message ?? `echoback job ended at status "${job.status}" with no transcript`;
  throw new Error(`echoback transcription failed — ${code}: ${message}`);
}

function assertCallbackUrlIsReachable(callbackUrl: string): void {
  const parsed = parseUrl(callbackUrl);
  if (!parsed) {
    throw new Error(
      `Activepieces produced an unusable resume URL (${callbackUrl}). Set AP_FRONTEND_URL to this instance's externally reachable URL.`
    );
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (UNREACHABLE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw new Error(
      `The resume URL Activepieces generated points at ${hostname}, which echoback refuses as a callback target (loopback, unspecified and link-local addresses are blocked as an SSRF guard). Set AP_FRONTEND_URL to a URL echoback can reach — private LAN addresses such as 10.x, 172.16-31.x and 192.168.x are accepted — and list that host in echoback's CALLBACK_ALLOWED_HOSTS.`
    );
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function toFailure(error: unknown): EchobackFailure {
  if (!(error instanceof HttpError)) {
    return {
      status: null,
      code: 'NO_RESPONSE',
      message: error instanceof Error ? error.message : String(error),
    };
  }
  const { status, body } = error.response;
  const payload = isRecord(body) && isRecord(body['error']) ? body['error'] : undefined;
  return {
    status,
    code: readNonEmptyString(payload?.['code']) ?? 'UNKNOWN',
    message:
      readNonEmptyString(payload?.['message']) ??
      (typeof body === 'string' ? body : JSON.stringify(body ?? {})),
  };
}

function describeHttpError(error: unknown): string {
  const failure = toFailure(error);
  const status = failure.status === null ? 'no HTTP response' : `HTTP ${failure.status}`;
  return `${status}: ${failure.code} — ${failure.message}`;
}

function describeSubmissionError({ error, callbackUrl }: DescribeSubmissionErrorParams): string {
  const failure = toFailure(error);
  const hint = CALLBACK_FAILURE_CODES.includes(failure.code)
    ? ` The callback URL sent was ${callbackUrl}; check AP_FRONTEND_URL is externally reachable and that its host is in echoback's CALLBACK_ALLOWED_HOSTS.`
    : '';
  return `echoback rejected the submission — ${describeHttpError(error)}${hint}`;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

const SUCCESS_STATUSES = ['transcribed', 'done', 'callback_failed'];

const CALLBACK_FAILURE_CODES = ['INVALID_CALLBACK_URL', 'CALLBACK_HOST_NOT_ALLOWED'];

const UNREACHABLE_HOST_PATTERNS = [
  /^localhost$/,
  /\.localhost$/,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1?$/,
  /^169\.254\./,
];

export const echobackApi = {
  submitJob,
  fetchJob,
  checkHealth,
  readJobIdFromCallback,
  assertTranscriptDelivered,
  assertCallbackUrlIsReachable,
  normalizeBaseUrl,
  describeHttpError,
  describeSubmissionError,
};

export type EchobackAuthValue = {
  baseUrl: string;
  apiToken: string;
};

export type EchobackJob = {
  job_id: string;
  job_ref: string | null;
  status: string;
  text: string | null;
  model: string | null;
  duration_ms: number | null;
  created_at: string;
  completed_at: string | null;
  delivered_at: string | null;
  error: { code: string; message: string } | null;
};

export type EchobackSubmission = {
  job_id: string;
  job_ref: string | null;
  status: string;
  status_url: string;
};

type EchobackFailure = {
  status: number | null;
  code: string;
  message: string;
};

type DescribeSubmissionErrorParams = {
  error: unknown;
  callbackUrl: string;
};

type SubmitJobParams = {
  auth: EchobackAuthValue;
  file: ApFile;
  callbackUrl: string;
  jobRef?: string;
  model?: string;
  vocabularyHint?: string;
};

type FetchJobParams = {
  auth: EchobackAuthValue;
  jobId: string;
};
