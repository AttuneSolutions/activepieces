# @attunesolutions/piece-yoke

An [Activepieces](https://www.activepieces.com) piece for [Yoke](https://www.yokecontrol.ai).
It reads instruction documents and agent email out of Yoke, and gates a flow on a human decision
made in Yoke's request queues.

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

Scopes requested: `instructions_read`, `request_queues_read`, `requests_write`,
`received_emails_read`. Tokens are scoped to the Yoke account behind the integration, so no tenant
id is needed.

> ### Upgrading to 0.4.0: existing Yoke connections must be deleted and recreated
>
> Activepieces stores the requested scopes when a connection is created, so a connection made
> before 0.4.0 cannot read email even after upgrading. Delete the Yoke connection, create it
> again with the same Client ID and Secret, and reconnect it in each flow that uses it.
>
> Until you do, **Get Received Email** and **Find Received Emails** answer `403` with an empty
> body — that is Yoke's Doorkeeper telling you the token lacks `received_emails_read`, not a
> misconfigured URL.

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

**Get Received Email** — fetches one message that arrived in a Yoke agent email inbox: `text_body`,
`html_body`, an allowlisted set of thirteen headers, and an attachment manifest. Takes the
`rem_...` id from the webhook payload. The inbox object is flattened to `inbox_token` /
`inbox_label` / `inbox_address` / `inbox_discarded`; `headers` stays an object and `attachments`
stays an array so a flow can loop it. Turning **Include HTML Body** off drops `html_body` from the
result entirely rather than sending it as null.

Two things worth knowing before mapping it:

- **A `410 content_expired` is a real answer, not a fault.** Yoke incinerates the raw message 30
  days after arrival; the metadata row outlives it. The action lets the error through rather than
  returning an empty result, because a silent empty result is how a flow posts a blank invoice. Use
  continue-on-failure and `{{step['error']}}` if a 31-day-old message is expected.
- **`attachments[].byte_size` can be null**, meaning the part is real and listed but its
  `Content-Transfer-Encoding` is one Yoke cannot decode. Downloading that position answers `422`.

**Find Received Emails** — searches message metadata: inbox, free-text over subject and sender,
exact sender address, a received-at window, attachment presence, and Yoke's own webhook delivery
status. No bodies — use **Get Received Email** for one message. Same
`{ rows, total, page, per_page, pages }` shape as **List Instructions**, and the same **Fetch All
Pages** behaviour.

`content_available` on a row is deliberately optimistic: Yoke computes it from the metadata alone,
because checking storage would be a query per row. `true` can still turn into a `410`.

**Custom API Call** — any other `https://app.yokecontrol.ai/api/v1` endpoint with the connection's
bearer token applied.

## Reading agent email: the flow

There is no Yoke trigger, and that is a decision rather than a gap — see **Known limitations**.
Activepieces' own **Catch Webhook** is the trigger:

```
Catch Webhook  ->  Get Received Email  ->  (the flow's own work)
```

Set it up in this order, because Yoke rejects a URL it cannot store, so the Activepieces step has
to exist first:

1. In Activepieces, add **Catch Webhook** as the trigger and copy its URL. Copy the **bare live
   URL** only: Yoke rejects a stored URL ending in `/test` or `/sync`, and one carrying a query
   string.
2. Set Catch Webhook's **Authentication** to **Header Auth**, header name `x-yoke-token`.
3. In Yoke, open the inbox, **Configure webhook**, paste the URL, leave the mode on **Header** and
   the header name at its `x-yoke-token` default, and copy the generated secret into Catch
   Webhook's value field.
4. Press Yoke's **Send test**. Yoke appends `/test` itself, which populates Catch Webhook's sample
   data without running the flow — so you map fields against a payload Yoke actually produced.
5. Map **Get Received Email**'s **Email ID** from `{{trigger['output'].body.email.id}}`.

Basic and HMAC work too; Yoke's three auth modes were built byte-compatible with Catch Webhook's
verifier. Header mode is documented here only because it is Yoke's default for a new webhook and
is one value pasted once in each direction.

**Nothing enforces that the two ends agree, and a mismatch is silent.** Catch Webhook cannot reject
a request: on a failed auth check it returns nothing, the engine has already answered `200`, and
Yoke records the delivery as succeeded. So if the flow stops seeing mail while Yoke says every
delivery succeeded, check these three, in this order:

- the secret was rotated in Yoke and not updated in Catch Webhook;
- the inbox's header name was changed away from `x-yoke-token` while Catch Webhook still looks for
  the old one;
- the two ends name different auth modes.

**Deduplicate in the flow.** Yoke's delivery is at-least-once and Catch Webhook sets no dedupe key,
so the same message can start two runs. Every payload carries a stable `event_id`
(`received_email.created:rem_...`) — key your own store on that. The engine's built-in dedupe
window is 30 seconds and Yoke's earliest retry is 48, so it would not have helped.

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
- **No `New Email Received` trigger ships, deliberately.** An Activepieces trigger's `run` returns
  `unknown[]` and the engine answers `200` before the body executes, so a Yoke trigger could not
  reject a forged delivery — only discard it after Yoke had recorded the delivery as succeeded.
  Catch Webhook has the same constraint but verifies all three of Yoke's auth modes rather than
  one, and does not hardcode a header name the operator can change. Revisit if Activepieces ever
  exposes a rejecting webhook response.
- **`Fetch All Pages` on Find Received Emails is unbounded.** An account with 50,000 messages and
  no filters is 2,000 sequential API calls inside one step, against Yoke's 300/minute per-account
  limit. Filter first.
- **The read API is account-wide.** `received_emails_read` grants read of every agent email inbox
  in the Yoke account, not just the one whose webhook fired. Per-inbox isolation does not exist and
  cannot be expressed with scopes.
- **The attachment download endpoint has its own, lower limit** — 60 requests a minute against the
  read endpoints' 300 — because every call re-downloads and re-parses the whole raw message to
  reach one part. A flow that fans out over attachments hits that one first.

## License

MIT
