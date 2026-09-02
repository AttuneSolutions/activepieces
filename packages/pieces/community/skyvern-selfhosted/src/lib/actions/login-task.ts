import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { skyvernAuth } from '../common/auth';
import { skyvernApiCall } from '../common/client';
import { browserProfileId, proxyLocation, webhookUrl } from '../common/props';

export const loginTaskAction = createAction({
	auth: skyvernAuth,
	name: 'login-task',
	displayName: 'Login Task',
	description: 'Signs in to a site with a stored credential.',
	audience: 'both',
	aiMetadata: {
		description:
			'Starts a Skyvern run that logs in to a URL using a stored credential, optionally into a reusable browser profile so later runs inherit the session. Credential Source selects WHICH VAULT to read from (skyvern / bitwarden / 1password / azure_vault) — it is not the kind of secret, despite sharing an API field name with Create Credential; passing `password` here fails. If the site challenges with a one-time code, push it with Push One-Time Code using the same TOTP Identifier. Starts a new asynchronous run (not idempotent); poll it with Get Workflow/Task Run.',
		idempotent: false,
	},
	props: {
		url: Property.ShortText({
			displayName: 'URL',
			description: 'The login page to sign in on.',
			required: true,
		}),
		credentialSource: Property.StaticDropdown({
			displayName: 'Credential Source (Vault)',
			description:
				'Which vault holds the credential. This is the API\'s `credential_type` field, but on this endpoint it means the vault, not the kind of secret — `password` is not a valid value here.',
			required: true,
			defaultValue: 'skyvern',
			options: {
				disabled: false,
				options: [
					{ label: 'Skyvern', value: 'skyvern' },
					{ label: 'Bitwarden', value: 'bitwarden' },
					{ label: '1Password', value: '1password' },
					{ label: 'Azure Key Vault', value: 'azure_vault' },
				],
			},
		}),
		credentialId: Property.ShortText({
			displayName: 'Credential ID',
			description: 'A `cred_…` id from Create Credential.',
			required: false,
		}),
		totpIdentifier: Property.ShortText({
			displayName: 'TOTP Identifier',
			description:
				'Where one-time codes will arrive. Push One-Time Code must use this same value to unblock the run.',
			required: false,
		}),
		browserProfileId,
		prompt: Property.LongText({
			displayName: 'Prompt',
			description: 'Extra instructions for working through an unusual login flow.',
			required: false,
		}),
		proxyLocation,
		webhookUrl,
	},
	async run(context) {
		const {
			url,
			credentialSource,
			credentialId,
			totpIdentifier,
			browserProfileId,
			prompt,
			proxyLocation,
			webhookUrl,
		} = context.propsValue;

		return skyvernApiCall({
			auth: context.auth.props,
			method: HttpMethod.POST,
			resourceUri: '/run/tasks/login',
			body: {
				url,
				credential_type: credentialSource,
				credential_id: credentialId,
				totp_identifier: totpIdentifier,
				browser_profile_id: browserProfileId,
				prompt,
				proxy_location: proxyLocation,
				webhook_url: webhookUrl,
			},
		});
	},
});
