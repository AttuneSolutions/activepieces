import { PieceAuth, Property } from '@activepieces/pieces-framework';
import { echobackApi } from './common';

const authDescription = `
Connect Activepieces to your self-hosted echoback transcription service.

1. Copy the service's base URL, e.g. \`https://voicemail.example.com\`.
2. Paste an API token issued by echoback — it is stored encrypted and never appears in flow JSON.

The base URL is validated against echoback's \`GET /health\` endpoint when you save the connection.
`;

export const echobackAuth = PieceAuth.CustomAuth({
  required: true,
  description: authDescription,
  props: {
    baseUrl: Property.ShortText({
      displayName: 'Base URL',
      description: 'e.g. https://voicemail.example.com — no trailing slash.',
      required: true,
    }),
    apiToken: PieceAuth.SecretText({
      displayName: 'API Token',
      description: 'Bearer token echoback expects on every endpoint except /health.',
      required: true,
    }),
  },
  validate: async ({ auth }) => echobackApi.checkHealth(auth.baseUrl),
});
