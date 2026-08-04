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
    content_markdown: doc.content_markdown ?? null,
    content_html: doc.content_html ?? null,
  };
}

export const yokeCommon = {
  approvalQueueDropdown: Property.Dropdown({
    displayName: 'Approval Queue',
    description: 'Yoke approval queue to assign this approval to.',
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
        const response = await yokeApiCall<YokeApprovalQueueListResponse>({
          accessToken: (auth as OAuth2PropertyValue).access_token,
          method: HttpMethod.GET,
          path: '/approval_queues',
          queryParams: { per_page: '100', active: 'true' },
        });
        if (response.body.approval_queues.length === 0) {
          return {
            disabled: false,
            options: [],
            placeholder: 'No approval queues found in Yoke.',
          };
        }
        return {
          disabled: false,
          options: response.body.approval_queues.map((queue) => ({
            label: queue.title,
            value: queue.id,
          })),
        };
      } catch (e) {
        return {
          disabled: true,
          options: [],
          placeholder: 'Failed to load approval queues. Check your Yoke connection.',
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
  content_markdown?: string;
  content_html?: string;
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

export type YokeApprovalQueue = {
  id: number;
  title: string;
  description: string | null;
  approvals_required: number;
  rerun_behavior: string;
  retention_days: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type YokeApprovalQueueListResponse = {
  approval_queues: YokeApprovalQueue[];
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
    approval_queue_id: number;
    url: string;
    created_at: string;
    resolved_at: string | null;
  };
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
  content_markdown: string | null;
  content_html: string | null;
};
