import {
    httpClient,
    HttpMessageBody,
    HttpMethod,
    HttpRequest,
    QueryParams,
} from '@activepieces/pieces-common';

export type SkyvernAuthValue = {
	baseUrl: string;
	apiKey: string;
};

export type SkyvernApiCallParams = {
	auth: SkyvernAuthValue;
	method: HttpMethod;
	resourceUri: string;
	query?: Record<string, string | number | string[] | undefined>;
	body?: unknown;
};

export function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.trim().replace(/\/+$/, '');
}

export async function skyvernApiCall<T extends HttpMessageBody>({
	auth,
	method,
	resourceUri,
	query,
	body,
}: SkyvernApiCallParams): Promise<T> {
	const qs: QueryParams = {};

	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value !== null && value !== undefined) {
				qs[key] = String(value);
			}
		}
	}

	const request: HttpRequest = {
		method,
		url: normalizeBaseUrl(auth.baseUrl) + resourceUri,
		headers: {
			'x-api-key': auth.apiKey,
		},
		queryParams: qs,
		body,
	};

	const response = await httpClient.sendRequest<T>(request);
	return response.body;
}
