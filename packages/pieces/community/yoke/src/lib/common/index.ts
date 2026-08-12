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
