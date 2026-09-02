import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { skyvernAuth } from '../common/auth';
import { skyvernApiCall } from '../common/client';

export function buildCredentialBody({
	name,
	credentialType,
	username,
	password,
	totpIdentifier,
	testedUrl,
}: BuildCredentialBodyParams): Record<string, unknown> {
	const credential = {
		...(username ? { username } : {}),
		...(password ? { password } : {}),
		...(totpIdentifier ? { totp_identifier: totpIdentifier } : {}),
	};

	return {
		name,
		credential_type: credentialType,
		credential,
		...(testedUrl ? { tested_url: testedUrl } : {}),
	};
}

export const createCredentialAction = createAction({
	auth: skyvernAuth,
	name: 'create-credential',
	displayName: 'Create Credential',
	description: 'Stores a credential in Skyvern for later logins.',
	audience: 'both',
	aiMetadata: {
		description:
			'Stores a credential in Skyvern\'s vault and returns its `cred_…` id for use with Login Task. Credential Type here is the KIND of secret (password / credit_card / secret) — it is NOT the vault selector of the same API name on Login Task. Password is optional: a passwordless account is created with a username and a TOTP Identifier alone. Each call creates a new credential, so it is not idempotent.',
		idempotent: false,
	},
	props: {
		name: Property.ShortText({
			displayName: 'Name',
			description: 'A label for this credential inside Skyvern.',
			required: true,
		}),
		credentialType: Property.StaticDropdown({
			displayName: 'Credential Type (Kind of Secret)',
			description:
				'What sort of secret this is. Not to be confused with Login Task\'s Credential Source, which selects a vault and uses the same underlying API field name.',
			required: true,
			defaultValue: 'password',
			options: {
				disabled: false,
				options: [
					{ label: 'Password', value: 'password' },
					{ label: 'Credit Card', value: 'credit_card' },
					{ label: 'Secret', value: 'secret' },
				],
			},
		}),
		username: Property.ShortText({
			displayName: 'Username',
			required: false,
		}),
		password: Property.ShortText({
			displayName: 'Password',
			description:
				'Leave empty for passwordless accounts that authenticate by one-time code alone.',
			required: false,
		}),
		totpIdentifier: Property.ShortText({
			displayName: 'TOTP Identifier',
			description:
				'The address or number one-time codes arrive at. Push One-Time Code must later be called with this same value.',
			required: false,
		}),
		testedUrl: Property.ShortText({
			displayName: 'Tested URL',
			description: 'The login page this credential is known to work on.',
			required: false,
		}),
	},
	async run(context) {
		return skyvernApiCall({
			auth: context.auth.props,
			method: HttpMethod.POST,
			resourceUri: '/credentials',
			body: buildCredentialBody(context.propsValue),
		});
	},
});

type BuildCredentialBodyParams = {
	name: string;
	credentialType: string;
	username?: string;
	password?: string;
	totpIdentifier?: string;
	testedUrl?: string;
};
