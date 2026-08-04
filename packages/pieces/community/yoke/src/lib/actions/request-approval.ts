import { HttpMethod, httpClient } from '@activepieces/pieces-common';
import {
  createAction,
  ExecutionType,
  Property,
} from '@activepieces/pieces-framework';
import { yokeAuth } from '../auth';
import {
  yokeApiCall,
  yokeApprovalPayload,
  yokeCommon,
  YokeRequestResponse,
} from '../common';

const LABEL_MAX = 20;
const INPUT_LABEL_MAX = 40;

export const requestApproval = createAction({
  auth: yokeAuth,
  name: 'request_approval',
  displayName: 'Request Approval in Yoke',
  description:
    'Send a request to a Yoke approval queue and then wait until someone responds.',
  audience: 'both',
  aiMetadata: {
    description:
      'Creates a request in Yoke assigned to an approval queue, then pauses the flow until a member responds, resuming with the decision and any text they left. Type "approval" is a yes/no gate, "approval_with_note" adds an optional note, "input" collects free text with no yes/no. Use as a human-in-the-loop gate before a sensitive downstream step. Not idempotent: each run may create a new Yoke request (deduped only when an Approval ID is supplied and the prior one is still pending).',
    idempotent: false,
  },
  props: {
    type: Property.StaticDropdown({
      displayName: 'Type',
      description:
        'What Yoke renders: Approval (approve/reject), Approval with Note (approve/reject plus a text box), or Input (text box only, no approve/reject).',
      required: true,
      defaultValue: 'approval',
      options: {
        disabled: false,
        options: [
          { label: 'Approval', value: 'approval' },
          { label: 'Approval with Note', value: 'approval_with_note' },
          { label: 'Input', value: 'input' },
        ],
      },
    }),
    title: Property.ShortText({
      displayName: 'Title',
      description: 'Headline shown in Yoke.',
      required: true,
    }),
    approvalQueue: yokeCommon.approvalQueueDropdown,
    message: Property.LongText({
      displayName: 'Message',
      description: 'Request details in Markdown. Yoke renders this.',
      required: true,
    }),
    approveButtonText: Property.ShortText({
      displayName: 'Approve Button Text',
      description: `Approve button label for the Approval types (max ${LABEL_MAX} characters).`,
      required: false,
      defaultValue: 'Approve',
    }),
    rejectButtonText: Property.ShortText({
      displayName: 'Reject Button Text',
      description: `Reject button label for the Approval types (max ${LABEL_MAX} characters).`,
      required: false,
      defaultValue: 'Reject',
    }),
    inputLabel: Property.ShortText({
      displayName: 'Input Label',
      description: `Caption for the text box on the Input type (max ${INPUT_LABEL_MAX} characters).`,
      required: false,
      defaultValue: 'Response',
    }),
    approvalId: Property.ShortText({
      displayName: 'Approval ID',
      description:
        'Optional stable id used to de-duplicate across flow reruns. Leave empty to auto-derive a per-run value.',
      required: false,
    }),
  },
  async run(context) {
    if (context.executionType === ExecutionType.BEGIN) {
      const {
        type,
        title,
        approvalQueue,
        message,
        approveButtonText,
        rejectButtonText,
        inputLabel,
        approvalId,
      } = context.propsValue;

      const key = yokeApprovalPayload.idempotencyKey({
        approvalId,
        runId: context.run.id,
        stepName: context.step.name,
      });

      const waitpoint = await context.run.createWaitpoint({ type: 'WEBHOOK' });
      const resumeUrl = (action: string) =>
        `${waitpoint.resumeUrl}/confirm?action=${action}`;

      // Tell Yoke how long the resume URL stays live so it can set its own expiry.
      const pausedFlowTimeoutDays = await fetchPausedFlowTimeoutDays(
        context.server.apiUrl,
      );

      // Yoke validates URL fields per request_type (422 on the wrong set), so send only what the type needs.
      // ponytail: slice caps button-label length; no prop-level maxLength validator exists in the framework.
      const typeFields =
        type === 'input'
          ? {
              response_url: resumeUrl('submit'),
              input_label: (inputLabel ?? 'Response').slice(0, INPUT_LABEL_MAX),
            }
          : {
              approve_url: resumeUrl('approve'),
              reject_url: resumeUrl('reject'),
              approve_label: (approveButtonText ?? 'Approve').slice(0, LABEL_MAX),
              reject_label: (rejectButtonText ?? 'Reject').slice(0, LABEL_MAX),
            };

      const response = await yokeApiCall<YokeRequestResponse>({
        accessToken: context.auth.access_token,
        method: HttpMethod.POST,
        path: '/requests',
        body: {
          idempotency_key: key,
          request_type: type,
          title,
          message_markdown: message,
          approval_queue_id: approvalQueue,
          ...(pausedFlowTimeoutDays !== null
            ? { paused_flow_timeout_days: pausedFlowTimeoutDays }
            : {}),
          ...typeFields,
        },
      });

      context.run.waitForWaitpoint(waitpoint.id);

      return {
        approved: null,
        action: null,
        feedback: null,
        approvalId: key,
        approvalQueue,
        yokeRequestId: response.body.request.id,
      };
    }

    const action = context.resumePayload.queryParams['action'] ?? null;
    return {
      approved: yokeApprovalPayload.decisionFromAction(action),
      action,
      feedback: yokeApprovalPayload.readFeedback(context.resumePayload.body),
      approvalId: yokeApprovalPayload.idempotencyKey({
        approvalId: context.propsValue.approvalId,
        runId: context.run.id,
        stepName: context.step.name,
      }),
      approvalQueue: context.propsValue.approvalQueue,
    };
  },
});

async function fetchPausedFlowTimeoutDays(
  apiUrl: string,
): Promise<number | null> {
  try {
    const response = await httpClient.sendRequest<
      Record<string, unknown>
    >({
      method: HttpMethod.GET,
      url: `${apiUrl}v1/flags`,
    });
    const value = response.body['PAUSED_FLOW_TIMEOUT_DAYS'];
    return typeof value === 'number' ? value : null;
  } catch (e) {
    return null;
  }
}

