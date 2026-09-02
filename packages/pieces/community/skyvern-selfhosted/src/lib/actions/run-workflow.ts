import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { skyvernAuth } from '../common/auth';
import { skyvernApiCall } from '../common/client';
import { browserProfileId, proxyLocation, webhookUrl } from '../common/props';

export const runWorkflowAction = createAction({
	auth: skyvernAuth,
	name: 'run-workflow',
	displayName: 'Run Workflow',
	description: 'Runs the workflow.',
	audience: 'both',
	aiMetadata: {
		description:
			'Starts a run of an existing Skyvern workflow, passing its parameters as a JSON object. Use Find Workflow to turn a title into an Agent ID, and always pass the permanent `wpid_…` id rather than a versioned `w_…` one — editing a workflow mints a new `w_…` but keeps the `wpid_…`, so a pinned `w_…` quietly runs a stale version. Each call triggers a new asynchronous run (not idempotent); the response returns a run identifier you poll separately with Get Workflow/Task Run.',
		idempotent: false,
	},
	props: {
		agentId: Property.ShortText({
			displayName: 'Agent ID',
			description:
				'The workflow\'s permanent `wpid_…` id, as returned by Find Workflow. Do not use a versioned `w_…` id — it pins the run to a stale version.',
			required: true,
		}),
		title: Property.ShortText({
			displayName: 'Workflow Run Title',
			required: false,
			description: 'The title for this workflow run.',
		}),
		parameters: Property.Json({
			displayName: 'Parameters',
			required: false,
			description:
				'The workflow\'s parameters as a JSON object, e.g. `{ "customer_email": "a@b.c" }`.',
		}),
		browserProfileId,
		proxyLocation,
		webhookUrl,
		runMetadata: Property.Json({
			displayName: 'Run Metadata',
			required: false,
			description: 'Arbitrary JSON stored alongside the run for your own bookkeeping.',
		}),
	},
	async run(context) {
		const {
			agentId,
			title,
			parameters,
			browserProfileId,
			proxyLocation,
			webhookUrl,
			runMetadata,
		} = context.propsValue;

		return skyvernApiCall({
			auth: context.auth.props,
			method: HttpMethod.POST,
			resourceUri: '/run/agents',
			body: {
				agent_id: agentId,
				title,
				parameters,
				browser_profile_id: browserProfileId,
				proxy_location: proxyLocation,
				webhook_url: webhookUrl,
				run_metadata: runMetadata,
			},
		});
	},
});
