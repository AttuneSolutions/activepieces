# @attunesolutions/piece-yoke

An [Activepieces](https://www.activepieces.com) piece for [Yoke](https://www.yokecontrol.ai).
It reads instruction documents out of Yoke and gates a flow on a human decision made in Yoke's
request queues.

## Install

Self-hosted Activepieces, as a custom piece:

```bash
npm install @attunesolutions/piece-yoke
```

Or from the Activepieces admin UI (**Platform Admin → Pieces → Install piece**) by npm package
name:

```
@attunesolutions/piece-yoke
```

Requires Activepieces `0.86.3` or later — the approval action resumes through the
`/confirm` waitpoint endpoint added in that release.

## Connection

OAuth2 client credentials, issued per Yoke integration:

1. Sign in to Yoke at [app.yokecontrol.ai](https://app.yokecontrol.ai).
2. Open **Integrations** and create one (or pick an existing one).
3. **Generate credentials** — Yoke shows a one-time **Client ID** and **Client Secret**.
4. Paste both into the connection.

Scopes requested: `instructions_read`, `request_queues_read`, `requests_write`. Tokens are
scoped to the Yoke account behind the integration, so no tenant id is needed.

Self-hosters pointing at a non-default Yoke deployment can set `YOKE_BASE_URL` on the worker;
it defaults to `https://app.yokecontrol.ai`.

## Actions

**List Instructions** — lists instruction documents with optional title search and a single tag
filter. Returns `{ rows, total, page, per_page, pages }`, each row flattened (tags joined to a
string, owner lifted to `owner_id` / `owner_name` / `owner_email`). **Fetch All Pages** walks
every page and returns one combined result.

**Get Instruction** — fetches one document by id from a dropdown, including `body` (raw Markdown,
served verbatim; can be an empty string for placeholder docs). The list action omits `body`, so
rows from **List Instructions** carry `body: null`. Yoke no longer returns HTML — render the
Markdown downstream if you need it.

**Request Approval in Yoke** — creates a request in a Yoke request queue, pauses the run, and
resumes with the decision:

| Type | Yoke renders | Resume yields |
| --- | --- | --- |
| Approval | approve / reject buttons | `approved: true \| false` |
| Approval with Note | the same plus a text box | `approved` + `feedback` |
| Input | text box only | `approved: null`, `feedback` |

Resume output is `{ approved, action, feedback, approvalId, requestQueue }`. `approved` is
`true` for `approve`, `false` for `reject` or `disapprove` (the latter is what Activepieces' own
confirmation page posts), and `null` for input submissions.

The action sends Yoke resume URLs on the `/confirm` endpoint, so a link scanner or email
prefetch cannot consume the waitpoint — only a POST resumes the run. It also reads
`PAUSED_FLOW_TIMEOUT_DAYS` from the instance's `/v1/flags` and passes it to Yoke as
`paused_flow_timeout_days`, so Yoke can expire its request when the resume URL dies.

**Custom API Call** — any other `https://app.yokecontrol.ai/api/v1` endpoint with the connection's
bearer token applied.

## Setup notes

| Setting | Why it matters |
| --- | --- |
| `AP_FRONTEND_URL` | must be the externally reachable URL of the instance; the resume URLs handed to Yoke are built from it. |
| `AP_WORKER_CONCURRENCY` | a paused approval releases its worker, but the flow still occupies a run slot; keep concurrency above 1 on busy instances. |
| `AP_PAUSED_FLOW_TIMEOUT_DAYS` | how long an unanswered approval stays resumable. Yoke treats an omitted or non-positive `paused_flow_timeout_days` as "use my default", so a missing flag is never an error. |
| Yoke integration `callback_host` allow-list | must contain the host of `AP_FRONTEND_URL`. Yoke validates `approve_url` / `reject_url` / `response_url` against it and rejects a mismatch with `422 callback_host_not_allowed` — the usual symptom of a self-hosted instance Yoke has not been told about. |

## Known limitations

- **Loop On Items is unsupported.** Waitpoints are keyed on `(flowRunId, stepName)`, so a second
  iteration of the same approval step in one run can collide with the first. Use one run (or a
  sub-flow) per approval.
- **A `404 not_found` / "Request queue not found." from the approval action is a body problem, not a
  route problem.** Yoke's strong params silently drop an unknown key, so a stale field name leaves
  `request_queue_id` nil and the queue lookup 404s. Check the request body before the URL.
- **Not idempotent across reruns** unless you supply an **Approval ID**. Left empty, the key is
  derived per run (`runId:stepName`), so a rerun creates a new Yoke request.
- **Deduplication is Yoke's.** A repeated `idempotency_key` only collapses while the earlier
  request is still pending.

## License

MIT
