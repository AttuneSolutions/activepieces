import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { skyvernAuth } from '../common/auth';
import { skyvernApiCall } from '../common/client';

export const getRunAction = createAction({
	auth: skyvernAuth,
	name: 'get-run',
	displayName: 'Get Workflow/Task Run',
	description: 'Retrieves a workflow or task run by ID.',
	audience: 'both',
	aiMetadata: { description: 'Retrieves the current status and details of a Skyvern run by its id. The same endpoint serves every run type, so it accepts a workflow run `wr_…`, a task run `tsk_…` and a v2 task run `tsk_v2_…` alike. Use to poll a run started via Run Agent Task, Login Task or Run Workflow until it completes and to read its results. Read-only and idempotent.', idempotent: true },
	props: {
		runId: Property.ShortText({
			displayName: 'Workflow/Task Run ID',
			description: 'A `wr_…`, `tsk_…` or `tsk_v2_…` id — all three are polled here.',
			required: true,
		}),
	},
	async run(context) {
		const { runId } = context.propsValue;

		const response = await skyvernApiCall({
			auth: context.auth.props,
			method: HttpMethod.GET,
			resourceUri: `/runs/${runId}`,
		});

		return response;
	},
});
