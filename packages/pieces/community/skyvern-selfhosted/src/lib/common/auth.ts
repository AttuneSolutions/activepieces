import { HttpMethod } from '@activepieces/pieces-common';
import { PieceAuth, Property } from '@activepieces/pieces-framework';
import { normalizeBaseUrl, skyvernApiCall } from './client';

const authDescription = `
Connect Activepieces to your own Skyvern deployment.

1. Enter the base URL of your Skyvern API, including the version path — e.g. \`https://skyvern.example.com/api/v1\`.
2. Paste an API key issued by that instance (Settings → API Keys).

The connection is validated against \`GET /workflows\` when you save it.
`;

export const skyvernAuth = PieceAuth.CustomAuth({
	required: true,
	description: authDescription,
	props: {
		baseUrl: Property.ShortText({
			displayName: 'Base URL',
			description:
				'e.g. https://skyvern.example.com/api/v1 — include the version path, no trailing slash.',
			required: true,
		}),
		apiKey: PieceAuth.SecretText({
			displayName: 'API Key',
			description: 'Sent as the x-api-key header on every request.',
			required: true,
		}),
	},
	validate: async ({ auth }) => {
		try {
			await skyvernApiCall({
				auth,
				method: HttpMethod.GET,
				resourceUri: '/workflows',
			});
			return { valid: true };
		} catch {
			return {
				valid: false,
				error: `Could not reach Skyvern at ${normalizeBaseUrl(
					auth.baseUrl,
				)} with that API key.`,
			};
		}
	},
});
