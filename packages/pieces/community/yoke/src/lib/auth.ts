import { OAuth2GrantType, PieceAuth } from '@activepieces/pieces-framework';

export const YOKE_BASE_URL =
  process.env['YOKE_BASE_URL'] ?? 'https://app.yokecontrol.ai';

const authDescription = `
Connect Activepieces to your Yoke account using OAuth2 client credentials.

**How to generate credentials:**
1. Sign in to Yoke at [app.yokecontrol.ai](https://app.yokecontrol.ai).
2. Open **Integrations** and create a new integration (or pick an existing one).
3. Click **Generate credentials** — Yoke will show a one-time **Client ID** and **Client Secret**.
4. Paste both values into the fields below and save.

Tokens are issued per integration and are scoped automatically to your Yoke account; no extra tenant ID is required.
`;

export const yokeAuth = PieceAuth.OAuth2({
  required: true,
  description: authDescription,
  grantType: OAuth2GrantType.CLIENT_CREDENTIALS,
  authUrl: '',
  tokenUrl: `${YOKE_BASE_URL}/oauth/token`,
  // received_emails_read joined in 0.4.0. Activepieces SNAPSHOTS this array onto
  // each connection when the connection is created and re-sends it verbatim on
  // every token refresh, so adding a scope here does not widen an existing
  // connection - it widens new ones. Every connection made before 0.4.0 must be
  // deleted and recreated or the two agent-email actions answer 403. See the
  // release note in README.md.
  scope: [
    'instructions_read',
    'request_queues_read',
    'requests_write',
    'received_emails_read',
  ],
});
