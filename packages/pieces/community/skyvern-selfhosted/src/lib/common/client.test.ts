import { describe, expect, it } from 'vitest';
import { normalizeBaseUrl } from './client';

describe('normalizeBaseUrl', () => {
	it('trims whitespace and trailing slashes so resource URIs join cleanly', () => {
		expect(normalizeBaseUrl('  https://skyvern.example.com/api/v1//  ') + '/workflows').toBe(
			'https://skyvern.example.com/api/v1/workflows',
		);
	});

	it('leaves an already-clean base URL untouched', () => {
		expect(normalizeBaseUrl('http://localhost:8000/api/v1')).toBe(
			'http://localhost:8000/api/v1',
		);
	});
});
