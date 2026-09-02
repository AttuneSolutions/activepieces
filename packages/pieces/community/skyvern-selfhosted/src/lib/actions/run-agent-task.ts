import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { skyvernAuth } from '../common/auth';
import { skyvernApiCall } from '../common/client';
import { browserProfileId, proxyLocation, webhookUrl } from '../common/props';

export function resolveEngine({
	engine,
	browserProfileId,
}: ResolveEngineParams): string | undefined {
	if (!browserProfileId) return engine;
	if (!engine) return DEFAULT_BROWSER_PROFILE_ENGINE;
	if (!BROWSER_PROFILE_ENGINES.includes(engine)) {
		throw new Error(
			`Skyvern rejects a Browser Profile ID on the "${engine}" engine — it is supported only by ${BROWSER_PROFILE_ENGINES.join(
				' and ',
			)}. Either clear the Browser Profile ID or set Engine to "${DEFAULT_BROWSER_PROFILE_ENGINE}". (Skyvern's own error calls this engine "skyvern_v2", but the value this field accepts is "${DEFAULT_BROWSER_PROFILE_ENGINE}".)`,
		);
	}
	return engine;
}

export const runAgentTaskAction = createAction({
	auth: skyvernAuth,
	name: 'run-agent-task',
	displayName: 'Run Agent Task',
	description: 'Runs task with specified prompt.',
	audience: 'both',
	aiMetadata: {
		description:
			'Launches a Skyvern browser-automation agent task from a natural-language prompt to navigate and act on a website, optionally starting at a given URL and extracting structured data via a schema. Supply a Browser Profile ID to reuse a session from an earlier Login Task — that requires the skyvern-2.0 or skyvern-3.0 engine, and this action selects skyvern-2.0 for you when Engine is left blank. Use to have an AI agent perform a web task (browse, fill forms, click) rather than running a predefined workflow. Each call starts a new asynchronous run, so it is not idempotent; the response returns a run identifier you poll separately with Get Workflow/Task Run.',
		idempotent: false,
	},
	props: {
		prompt: Property.ShortText({
			displayName: 'Prompt',
			description: 'The goal or task description for Skyvern to accomplish.',
			required: true,
		}),
		url: Property.ShortText({
			displayName: 'URL',
			description: 'The starting URL for the task.',
			required: false,
		}),
		title: Property.ShortText({
			displayName: 'Task Run Title',
			description: 'A label for this run.',
			required: false,
		}),
		engine: Property.StaticDropdown({
			displayName: 'Engine',
			description:
				'Leave blank to let Skyvern choose, except with a Browser Profile ID — profiles need skyvern-2.0 or newer, and blank resolves to skyvern-2.0.',
			required: false,
			options: {
				disabled: false,
				options: [
					{ label: 'Skyvern 1.0', value: 'skyvern-1.0' },
					{ label: 'Skyvern 2.0', value: 'skyvern-2.0' },
					{ label: 'Skyvern 3.0', value: 'skyvern-3.0' },
					{ label: 'OpenAI CUA', value: 'openai-cua' },
					{ label: 'Anthropic CUA', value: 'anthropic-cua' },
				],
			},
		}),
		browserProfileId,
		startFreshBrowser: Property.Checkbox({
			displayName: 'Start Fresh Browser',
			description:
				'Ignore the browser profile\'s saved session and start from a clean browser for this run.',
			required: false,
		}),
		totpIdentifier: Property.ShortText({
			displayName: 'TOTP Identifier',
			description:
				'Where one-time codes will arrive. Push One-Time Code must use this same value to unblock the run.',
			required: false,
		}),
		webhookUrl,
		proxyLocation,
		maxSteps: Property.Number({
			displayName: 'Max Steps',
			required: false,
			description:
				'Maximum number of steps the task can take. Task will fail if it exceeds this number.',
		}),
		dataExtractionSchema: Property.Json({
			displayName: 'Data Extraction Schema',
			required: false,
			description: 'The schema for data to be extracted from the webpage.',
		}),
	},
	async run(context) {
		const {
			prompt,
			proxyLocation,
			url,
			title,
			webhookUrl,
			dataExtractionSchema,
			maxSteps,
			engine,
			browserProfileId,
			startFreshBrowser,
			totpIdentifier,
		} = context.propsValue;

		return skyvernApiCall({
			auth: context.auth.props,
			method: HttpMethod.POST,
			resourceUri: '/run/tasks',
			body: {
				prompt,
				url,
				title,
				engine: resolveEngine({ engine, browserProfileId }),
				browser_profile_id: browserProfileId,
				start_fresh_browser: startFreshBrowser,
				totp_identifier: totpIdentifier,
				proxy_location: proxyLocation,
				data_extraction_schema: dataExtractionSchema,
				max_steps: maxSteps,
				webhook_url: webhookUrl,
			},
		});
	},
});

const DEFAULT_BROWSER_PROFILE_ENGINE = 'skyvern-2.0';

const BROWSER_PROFILE_ENGINES = ['skyvern-2.0', 'skyvern-3.0'];

type ResolveEngineParams = {
	engine?: string;
	browserProfileId?: string;
};
