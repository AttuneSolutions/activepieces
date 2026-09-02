import { Property } from '@activepieces/pieces-framework';

const PROXY_LOCATION_OPTIONS = [
	{ label: 'Residential', value: 'RESIDENTIAL' },
	{ label: 'Spain', value: 'RESIDENTIAL_ES' },
	{ label: 'Ireland', value: 'RESIDENTIAL_IE' },
	{ label: 'United Kingdom', value: 'RESIDENTIAL_GB' },
	{ label: 'India', value: 'RESIDENTIAL_IN' },
	{ label: 'Japan', value: 'RESIDENTIAL_JP' },
	{ label: 'France', value: 'RESIDENTIAL_FR' },
	{ label: 'Germany', value: 'RESIDENTIAL_DE' },
	{ label: 'New Zealand', value: 'RESIDENTIAL_NZ' },
	{ label: 'South Africa', value: 'RESIDENTIAL_ZA' },
	{ label: 'Argentina', value: 'RESIDENTIAL_AR' },
	{ label: 'ISP Proxy', value: 'RESIDENTIAL_ISP' },
	{ label: 'California (US)', value: 'US-CA' },
	{ label: 'New York (US)', value: 'US-NY' },
	{ label: 'Texas (US)', value: 'US-TX' },
	{ label: 'Florida (US)', value: 'US-FL' },
	{ label: 'Washington (US)', value: 'US-WA' },
	{ label: 'No Proxy', value: 'NONE' },
];

export const proxyLocation = Property.StaticDropdown({
	displayName: 'Proxy Location',
	required: false,
	options: {
		disabled: false,
		options: PROXY_LOCATION_OPTIONS,
	},
});

export const browserProfileId = Property.ShortText({
	displayName: 'Browser Profile ID',
	required: false,
	description:
		'A `bp_…` id from Create Browser Profile. Reuses that profile\'s cookies and session, so a run can pick up where a previous login left off.',
});

export const webhookUrl = Property.ShortText({
	displayName: 'Webhook Callback URL',
	required: false,
	description: 'URL Skyvern calls when the run finishes.',
});

export type ListWorkflowResponse = {
	workflow_permanent_id: string;
	title: string;
	workflow_definition: {
		parameters: {
			parameter_type: string;
			key: string;
			workflow_parameter_type: string;
			default_value: unknown;
		}[];
	};
};
