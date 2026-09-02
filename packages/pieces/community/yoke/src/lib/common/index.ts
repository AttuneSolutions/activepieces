import {
  AuthenticationType,
  httpClient,
  HttpMessageBody,
  HttpMethod,
  HttpResponse,
} from '@activepieces/pieces-common';
import {
  OAuth2PropertyValue,
  Property,
} from '@activepieces/pieces-framework';
import { yokeAuth, YOKE_BASE_URL } from '../auth';

export async function yokeApiCall<T extends HttpMessageBody>({
  accessToken,
  method,
  path,
  queryParams,
  body,
}: {
  accessToken: string;
  method: HttpMethod;
  path: string;
  queryParams?: Record<string, string>;
  body?: unknown;
}): Promise<HttpResponse<T>> {
  return httpClient.sendRequest<T>({
    method,
    url: `${YOKE_BASE_URL}/api/v1${path}`,
    authentication: {
      type: AuthenticationType.BEARER_TOKEN,
      token: accessToken,
    },
    queryParams,
    body,
  });
}

export function flattenInstruction(
  doc: YokeInstructionDocument,
): FlatYokeInstruction {
  return {
    id: doc.id,
    title: doc.title,
    tags: Array.isArray(doc.tags) ? doc.tags.join(', ') : null,
    owner_id: doc.owner?.id ?? null,
    owner_name: doc.owner?.name ?? null,
    owner_email: doc.owner?.email ?? null,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    body: doc.body ?? null,
  };
}

// Nested objects become flat inbox_* fields, in the shape flattenInstruction
// already sets, because Activepieces' mapping UI offers flat keys. attachments
// stays an array (a flow loops it) and headers stays an object (thirteen fixed
// keys, and flattening them would invent header_content_type and friends).
//
// includeHtml: false DROPS the key rather than sending null, so the mapping UI
// does not offer a field that is always empty.
export function flattenReceivedEmail(
  email: YokeReceivedEmail,
  { includeHtml }: { includeHtml: boolean },
): FlatYokeReceivedEmail {
  const flat: FlatYokeReceivedEmail = {
    id: email.id,
    message_id: email.message_id,
    from: email.from,
    subject: email.subject,
    received_at: email.received_at,
    recorded_at: email.recorded_at,
    has_attachments: email.has_attachments,
    attachment_count: email.attachment_count,
    content_available_until: email.content_available_until ?? null,
    inbox_token: email.inbox?.token ?? null,
    inbox_label: email.inbox?.label ?? null,
    inbox_address: email.inbox?.address ?? null,
    inbox_discarded: email.inbox?.discarded ?? null,
    text_body: email.text_body ?? null,
    headers: email.headers ?? {},
    attachments: email.attachments ?? [],
    attachments_truncated: email.attachments_truncated ?? false,
  };

  if (includeHtml) {
    flat.html_body = email.html_body ?? null;
  }

  return flat;
}

// The index rows carry three keys the show response does not, and none of the
// content keys. Kept separate so a flow mapping a search result is not offered
// text_body fields that will never be populated.
export function flattenReceivedEmailRow(
  row: YokeReceivedEmailRow,
): FlatYokeReceivedEmailRow {
  return {
    id: row.id,
    message_id: row.message_id,
    from: row.from,
    subject: row.subject,
    received_at: row.received_at,
    recorded_at: row.recorded_at,
    has_attachments: row.has_attachments,
    attachment_count: row.attachment_count,
    content_available_until: row.content_available_until ?? null,
    inbox_token: row.inbox?.token ?? null,
    inbox_label: row.inbox?.label ?? null,
    inbox_address: row.inbox?.address ?? null,
    inbox_discarded: row.inbox?.discarded ?? null,
    // Optimistic by design: Yoke computes this from the pointer alone, because
    // the definitive check is a storage query per row. true can still 410.
    content_available: row.content_available,
    webhook_status: row.webhook_status,
    content_path: row.content_path,
  };
}

export const yokeCommon = {
  requestQueueDropdown: Property.Dropdown({
    displayName: 'Request Queue',
    description: 'Yoke request queue to assign this request to.',
    auth: yokeAuth,
    refreshers: [],
    required: true,
    options: async ({ auth }) => {
      if (!auth) {
        return {
          disabled: true,
          options: [],
          placeholder: 'Please connect your Yoke account first',
        };
      }
      try {
        const response = await yokeApiCall<YokeRequestQueueListResponse>({
          accessToken: (auth as OAuth2PropertyValue).access_token,
          method: HttpMethod.GET,
          path: '/request_queues',
          queryParams: { per_page: '100', active: 'true' },
        });
        if (response.body.request_queues.length === 0) {
          return {
            disabled: false,
            options: [],
            placeholder: 'No request queues found in Yoke.',
          };
        }
        return {
          disabled: false,
          options: response.body.request_queues.map((queue) => ({
            label: queue.title,
            value: queue.id,
          })),
        };
      } catch (e) {
        return {
          disabled: true,
          options: [],
          placeholder: 'Failed to load request queues. Check your Yoke connection.',
        };
      }
    },
  }),
  inboxDropdown: Property.Dropdown({
    displayName: 'Inbox',
    description:
      'Narrow the search to one agent email inbox. Leave empty to search every inbox in the account.',
    auth: yokeAuth,
    refreshers: [],
    required: false,
    options: async ({ auth }) => {
      if (!auth) {
        return {
          disabled: true,
          options: [],
          placeholder: 'Please connect your Yoke account first',
        };
      }
      try {
        const response = await yokeApiCall<YokeAgentEmailListResponse>({
          accessToken: (auth as OAuth2PropertyValue).access_token,
          method: HttpMethod.GET,
          path: '/received_emails',
          queryParams: { per_page: '100' },
        });
        // There is no inbox index endpoint in the read API - it is deliberately
        // read-only over messages - so the inbox list is derived from the mail
        // itself. An inbox that has never received anything therefore does not
        // appear; the flow author can still type its token into a filter.
        const inboxes = new Map<string, string>();
        for (const row of response.body.received_emails) {
          if (row.inbox?.token) {
            inboxes.set(row.inbox.token, row.inbox.label ?? row.inbox.address ?? row.inbox.token);
          }
        }
        if (inboxes.size === 0) {
          return {
            disabled: false,
            options: [],
            placeholder: 'No agent email inboxes have received mail yet.',
          };
        }
        return {
          disabled: false,
          options: [...inboxes].map(([token, label]) => ({ label, value: token })),
        };
      } catch (e) {
        return {
          disabled: true,
          options: [],
          placeholder: 'Failed to load inboxes. Check your Yoke connection.',
        };
      }
    },
  }),
  instructionDropdown: Property.Dropdown({
    displayName: 'Instruction',
    description: 'Pick the instruction document to fetch.',
    auth: yokeAuth,
    refreshers: [],
    required: true,
    options: async ({ auth }) => {
      if (!auth) {
        return {
          disabled: true,
          options: [],
          placeholder: 'Please connect your Yoke account first',
        };
      }
      try {
        const response = await yokeApiCall<YokeInstructionListResponse>({
          accessToken: (auth as OAuth2PropertyValue).access_token,
          method: HttpMethod.GET,
          path: '/instructions',
          queryParams: { per_page: '100' },
        });
        if (response.body.documents.length === 0) {
          return {
            disabled: false,
            options: [],
            placeholder:
              'No instructions found. Create one in Yoke, then refresh.',
          };
        }
        return {
          disabled: false,
          options: response.body.documents.map((doc) => ({
            label: doc.title,
            value: doc.id,
          })),
        };
      } catch (e) {
        return {
          disabled: true,
          options: [],
          placeholder:
            'Failed to load instructions. Check your Yoke connection.',
        };
      }
    },
  }),
};

export const yokeApprovalPayload = {
  decisionFromAction,
  readFeedback,
  idempotencyKey,
};

function decisionFromAction(action: string | null): boolean | null {
  if (action === 'approve') return true;
  if (action === 'reject' || action === 'disapprove') return false;
  return null;
}

function readFeedback(body: unknown): string | null {
  if (body !== null && typeof body === 'object') {
    if ('note' in body && typeof body.note === 'string') return body.note;
    if ('response' in body && typeof body.response === 'string') {
      return body.response;
    }
  }
  return null;
}

function idempotencyKey({
  approvalId,
  runId,
  stepName,
}: {
  approvalId: string | undefined;
  runId: string;
  stepName: string;
}): string {
  return approvalId || `${runId}:${stepName}`;
}

export type YokeInstructionDocument = {
  id: number;
  title: string;
  tags: string[];
  owner: { id: number; name: string; email: string } | null;
  created_at: string;
  updated_at: string;
  body?: string;
};

export type YokeInstructionListResponse = {
  documents: YokeInstructionDocument[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
};

export type YokeInstructionShowResponse = {
  document: YokeInstructionDocument;
};

export type YokeRequestQueue = {
  id: number;
  title: string;
  approvals_required: number;
  rerun_behavior: string;
  active: boolean;
};

export type YokeRequestQueueListResponse = {
  request_queues: YokeRequestQueue[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
};

export type YokeRequestResponse = {
  request: {
    id: number;
    idempotency_key: string;
    request_type: string;
    status: string;
    title: string;
    request_queue_id: number;
    url: string;
    created_at: string;
    resolved_at: string | null;
  };
};

export type YokeReceivedEmailInbox = {
  token: string;
  label: string | null;
  label_slug: string | null;
  address: string;
  routing_address: string;
  discarded: boolean;
};

export type YokeReceivedEmailAttachment = {
  position: number;
  filename: string;
  content_type: string;
  // Null when the part's Content-Transfer-Encoding cannot be decoded. That
  // position's download then answers 422 rather than serving the wrong bytes.
  byte_size: number | null;
  download_path: string;
};

export type YokeReceivedEmail = {
  id: string;
  message_id: string;
  from: string | null;
  subject: string | null;
  received_at: string;
  recorded_at: string;
  has_attachments: boolean;
  attachment_count: number;
  content_available_until: string | null;
  inbox: YokeReceivedEmailInbox;
  text_body: string | null;
  html_body: string | null;
  headers: Record<string, string | string[] | null>;
  attachments: YokeReceivedEmailAttachment[];
  attachments_truncated: boolean;
};

export type YokeReceivedEmailRow = {
  id: string;
  message_id: string;
  from: string | null;
  subject: string | null;
  received_at: string;
  recorded_at: string;
  has_attachments: boolean;
  attachment_count: number;
  content_available_until: string | null;
  inbox: YokeReceivedEmailInbox;
  content_available: boolean;
  webhook_status: string;
  content_path: string;
};

export type YokeReceivedEmailShowResponse = {
  received_email: YokeReceivedEmail;
};

export type YokeReceivedEmailListResponse = {
  received_emails: YokeReceivedEmailRow[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
};

// The inbox dropdown reads the message index, so it shares that response type.
export type YokeAgentEmailListResponse = YokeReceivedEmailListResponse;

export type FlatYokeReceivedEmail = {
  id: string;
  message_id: string;
  from: string | null;
  subject: string | null;
  received_at: string;
  recorded_at: string;
  has_attachments: boolean;
  attachment_count: number;
  content_available_until: string | null;
  inbox_token: string | null;
  inbox_label: string | null;
  inbox_address: string | null;
  inbox_discarded: boolean | null;
  text_body: string | null;
  html_body?: string | null;
  headers: Record<string, string | string[] | null>;
  attachments: YokeReceivedEmailAttachment[];
  attachments_truncated: boolean;
};

export type FlatYokeReceivedEmailRow = {
  id: string;
  message_id: string;
  from: string | null;
  subject: string | null;
  received_at: string;
  recorded_at: string;
  has_attachments: boolean;
  attachment_count: number;
  content_available_until: string | null;
  inbox_token: string | null;
  inbox_label: string | null;
  inbox_address: string | null;
  inbox_discarded: boolean | null;
  content_available: boolean;
  webhook_status: string;
  content_path: string;
};

export type FlatYokeInstruction = {
  id: number;
  title: string;
  tags: string | null;
  owner_id: number | null;
  owner_name: string | null;
  owner_email: string | null;
  created_at: string;
  updated_at: string;
  body: string | null;
};
