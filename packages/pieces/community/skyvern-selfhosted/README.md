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

- Run Agent Task
- Run Workflow
- Cancel Run
- Get Workflow/Task Run
- Find Workflow
- Custom API Call

## Building

```bash
turbo run build --filter=@attunesolutions/piece-skyvern-selfhosted
```
