import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { skyvernAuth } from '../common/auth';
import { skyvernApiCall } from '../common/client';

export const pushTotpCodeAction = createAction({
	auth: skyvernAuth,
	name: 'push-totp-code',
	displayName: 'Push One-Time Code',
	description: 'Forwards a one-time code to a waiting Skyvern run.',
	audience: 'both',
	aiMetadata: {
		description:
			'Pushes a one-time passcode (2FA/OTP) to Skyvern so a run blocked on a login challenge can continue. Pass the entire raw email or SMS body as Content — Skyvern extracts the digits itself, which survives the sender restyling their messages, so never pre-parse the code. The TOTP Identifier must match the one on the credential or task that is waiting. Each push is a new code, so it is not idempotent.',
		idempotent: false,
	},
	props: {
		totpIdentifier: Property.ShortText({
			displayName: 'TOTP Identifier',
			description:
				'The identifier the waiting run is polling on — usually the email address or phone number the code was sent to.',
			required: true,
		}),
		content: Property.LongText({
			displayName: 'Content',
			description:
				'The whole raw message body. Skyvern extracts the code from it, so paste the entire email rather than a parsed-out number.',
			required: true,
		}),
		source: Property.ShortText({
			displayName: 'Source',
			description: 'Where the code arrived from, e.g. `email` or `sms`.',
			required: false,
		}),
		expiredAt: Property.ShortText({
			displayName: 'Expires At',
			description: 'ISO-8601 timestamp after which the code is no longer valid.',
			required: false,
		}),
		taskId: Property.ShortText({
			displayName: 'Task ID',
			description: 'Scope the code to a single task run.',
			required: false,
		}),
		workflowRunId: Property.ShortText({
			displayName: 'Workflow Run ID',
			description: 'Scope the code to a single workflow run.',
			required: false,
		}),
	},
	async run(context) {
		const { totpIdentifier, content, source, expiredAt, taskId, workflowRunId } =
			context.propsValue;

		return skyvernApiCall({
			auth: context.auth.props,
			method: HttpMethod.POST,
			resourceUri: '/credentials/totp',
			body: {
				totp_identifier: totpIdentifier,
				content,
				source,
				expired_at: expiredAt,
				task_id: taskId,
				workflow_run_id: workflowRunId,
			},
		});
	},
});
