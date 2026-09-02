import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { skyvernAuth } from '../common/auth';
import { skyvernApiCall } from '../common/client';
import { proxyLocation } from '../common/props';

export const createBrowserProfileAction = createAction({
	auth: skyvernAuth,
	name: 'create-browser-profile',
	displayName: 'Create Browser Profile',
	description: 'Creates a reusable browser profile.',
	audience: 'both',
	aiMetadata: {
		description:
			'Creates a Skyvern browser profile and returns its `bp_…` id. A profile carries cookies and session state between runs, so a later task can reuse a login instead of signing in again. Pass the id to Login Task or Run Agent Task. Each call creates a new profile, so it is not idempotent.',
		idempotent: false,
	},
	props: {
		name: Property.ShortText({
			displayName: 'Name',
			description: 'A label for this profile inside Skyvern.',
			required: true,
		}),
		description: Property.ShortText({
			displayName: 'Description',
			required: false,
		}),
		proxyLocation,
	},
	async run(context) {
		const { name, description, proxyLocation } = context.propsValue;

		return skyvernApiCall({
			auth: context.auth.props,
			method: HttpMethod.POST,
			resourceUri: '/browser_profiles',
			body: {
				name,
				description,
				proxy_location: proxyLocation,
			},
		});
	},
});
