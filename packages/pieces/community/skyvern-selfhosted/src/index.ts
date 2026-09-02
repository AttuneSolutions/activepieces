import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { createPiece } from '@activepieces/pieces-framework';
import { cancelRunAction } from './lib/actions/cancel-run';
import { findWorkflowAction } from './lib/actions/find-workflow';
import { getRunAction } from './lib/actions/get-run';
import { runAgentTaskAction } from './lib/actions/run-agent-task';
import { runWorkflowAction } from './lib/actions/run-workflow';
import { skyvernAuth } from './lib/common/auth';
import { normalizeBaseUrl } from './lib/common/client';

export const skyvernSelfHosted = createPiece({
	displayName: 'Skyvern (Self-Hosted)',
	description:
		'Run Skyvern browser-automation agent tasks and workflows against your own self-hosted Skyvern instance.',
	auth: skyvernAuth,
	minimumSupportedRelease: '0.85.2',
	logoUrl: 'https://cdn.activepieces.com/pieces/skyvern.jpg',
	authors: ['rimjhimyadav', 'kishanprmr', 'sgsimpson'],
	actions: [
		runAgentTaskAction,
		runWorkflowAction,
		cancelRunAction,
		getRunAction,
		findWorkflowAction,
		createCustomApiCallAction({
			auth: skyvernAuth,
			baseUrl: (auth) => (auth ? normalizeBaseUrl(auth.props.baseUrl) : ''),
			authMapping: async (auth) => {
				return {
					'x-api-key': auth.props.apiKey,
				};
			},
		}),
	],
	triggers: [],
});
