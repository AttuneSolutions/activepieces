# @attunesolutions/piece-skyvern-selfhosted

An [Activepieces](https://www.activepieces.com) piece for a **self-hosted**
[Skyvern](https://www.skyvern.com) instance. It is the community Skyvern piece with the
hardcoded `https://api.skyvern.com/v1` base URL replaced by a field on the connection, so
each connection points at your own deployment.

## Install

```bash
npm install @attunesolutions/piece-skyvern-selfhosted
```

Or from the Activepieces admin UI (**Platform Admin → Pieces → Install piece**) by npm
package name.

## Connection

| Field | Description |
| --- | --- |
| Base URL | Your Skyvern API root **including the version path**, e.g. `https://skyvern.example.com/api/v1`. A trailing slash is trimmed. |
| API Key | Sent as the `x-api-key` header on every request. |

Saving the connection calls `GET {Base URL}/workflows` to verify both values.

## Actions

| Action | Endpoint | Returns |
| --- | --- | --- |
| Run Agent Task | `POST /run/tasks` | run id |
| Run Workflow | `POST /run/agents` | run id |
| Login Task | `POST /run/tasks/login` | run id |
| Push One-Time Code | `POST /credentials/totp` | ack |
| Create Credential | `POST /credentials` | `credential_id` (`cred_…`) |
| Create Browser Profile | `POST /browser_profiles` | `browser_profile_id` (`bp_…`) |
| Cancel Run | `POST /runs/{id}/cancel` | run |
| Get Workflow/Task Run | `GET /runs/{id}` | run |
| Find Workflow | `GET /workflows` | matches |
| Custom API Call | any | body |

Every action returns the parsed response body, so a later step reads
`{{ step_1['output'].credential_id }}` rather than `.body.credential_id`.

All actions above except **Custom API Call** are built from static properties only, so they can be
added, validated and published entirely over the Activepieces MCP API with no visit to the web UI.
Custom API Call keeps the framework's dynamic `url`/`body` properties: it runs fine, but a step
built from it over MCP is marked invalid and blocks publishing, because a dynamic property's schema
is only written into `propertySettings` by the builder UI.

### Two different fields called `credential_type`

The API reuses one field name for two unrelated enums, and the piece renames one of them to keep
them apart:

| Piece property | API field | Means | Values |
| --- | --- | --- | --- |
| Create Credential → **Credential Type (Kind of Secret)** | `credential_type` | what sort of secret this is | `password`, `credit_card`, `secret` |
| Login Task → **Credential Source (Vault)** | `credential_type` | which vault to read from | `skyvern`, `bitwarden`, `1password`, `azure_vault` |

Passing `password` as a Login Task's Credential Source fails confusingly. It is the natural mistake.

### Browser profiles need a v2 engine

`browser_profile_id` is rejected by `skyvern-1.0` and the CUA engines. Run Agent Task selects
`skyvern-2.0` for you when a Browser Profile ID is set and Engine is blank, and throws a clear
error when an incompatible engine is chosen explicitly. Skyvern's own message names the engine
`skyvern_v2`, but the value the field accepts is `skyvern-2.0`.

### Run a workflow by its permanent id

Run Workflow posts to `POST /run/agents`; `POST /agents/{id}` is the *update* endpoint and answers
a run attempt with *"Invalid workflow definition. Workflow should be provided in either yaml or
json format."* Pass the permanent `wpid_…` id, never a versioned `w_…` one — editing a workflow
mints a new `w_…` while the `wpid_…` stays put, so a pinned `w_…` quietly runs a stale version.
Find Workflow returns `workflow_permanent_id`, which is the value Agent ID wants.

## Verifying webhook callbacks

Skyvern signs every callback with an `x-skyvern-signature` header: hex HMAC-SHA256 over the **raw
request body** using your API key as the secret. No timestamp is mixed in, so the signature is over
the body alone.

In a Code step:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export const code = async (inputs) => {
  const expected = createHmac('sha256', inputs.apiKey)
    .update(inputs.rawBody, 'utf8')
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(inputs.signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
};
```

Compare with `timingSafeEqual`, not `===`, and hash the raw body exactly as received — re-serialising
the parsed JSON changes the bytes and the signature will not match.

## Building

```bash
turbo run build --filter=@attunesolutions/piece-skyvern-selfhosted
```
