import { describe, expect, it } from 'vitest';
import { buildCredentialBody } from './create-credential';
import { resolveEngine } from './run-agent-task';

describe('resolveEngine', () => {
	it('leaves the engine alone when no browser profile is used', () => {
		expect(resolveEngine({ engine: 'skyvern-1.0' })).toBe('skyvern-1.0');
		expect(resolveEngine({})).toBeUndefined();
	});

	it('defaults to skyvern-2.0 when a browser profile needs one', () => {
		expect(resolveEngine({ browserProfileId: 'bp_1' })).toBe('skyvern-2.0');
	});

	it('keeps an explicit engine that supports browser profiles', () => {
		expect(resolveEngine({ engine: 'skyvern-3.0', browserProfileId: 'bp_1' })).toBe(
			'skyvern-3.0',
		);
	});

	it('throws with the accepted enum value when the engine cannot take a profile', () => {
		expect(() => resolveEngine({ engine: 'openai-cua', browserProfileId: 'bp_1' })).toThrow(
			/skyvern-2\.0/,
		);
	});
});

describe('buildCredentialBody', () => {
	it('nests credential fields and omits the ones left empty', () => {
		expect(
			buildCredentialBody({
				name: 'Contented',
				credentialType: 'password',
				username: 'a@b.c',
				totpIdentifier: 'a@b.c',
			}),
		).toEqual({
			name: 'Contented',
			credential_type: 'password',
			credential: { username: 'a@b.c', totp_identifier: 'a@b.c' },
		});
	});

	it('includes a password when one is given', () => {
		const body = buildCredentialBody({
			name: 'x',
			credentialType: 'password',
			username: 'u',
			password: 'p',
			testedUrl: 'https://example.com/login',
		});
		expect(body['credential']).toEqual({ username: 'u', password: 'p' });
		expect(body['tested_url']).toBe('https://example.com/login');
	});
});
