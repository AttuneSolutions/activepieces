# @attunesolutions/piece-echoback

An [Activepieces](https://www.activepieces.com) piece that submits voicemail audio to a
self-hosted [echoback](https://github.com/AttuneSolutions/echoback) transcription service,
pauses the flow while whisper.cpp works, and resumes it with the transcript.

Transcription is asynchronous: echoback accepts the audio, returns a job id, and calls back
when the text is ready. The flow run is suspended in between, so it holds no worker.

## Install

Self-hosted Activepieces, as a custom piece:

```bash
npm install @attunesolutions/piece-echoback
```

Or install it from the Activepieces admin UI (**Platform Admin → Pieces → Install piece**)
by npm package name:

```
@attunesolutions/piece-echoback
```

Requires Activepieces `0.36.1` or later, and a reachable echoback instance.

## Connection

| Field | Description |
| --- | --- |
| Base URL | echoback's public URL, e.g. `https://echoback.example.com` |
| API token | bearer token echoback accepts on `POST /jobs` and `GET /jobs/{id}` |

## Action

**Transcribe Voicemail and Wait** — runs twice:

1. `BEGIN`: creates a `WEBHOOK` waitpoint, `POST`s the audio to `/jobs` with the waitpoint's
   resume URL as `callback_url`, then pauses the run. The step's intermediate output is
   echoback's `202` body (`job_id`, `job_ref`, `status`, `status_url`).
2. `RESUME`: reads **only** `job_id` from the callback body, re-fetches
   `GET /jobs/{job_id}` with the bearer token, and returns the whole job — `text`,
   `duration_ms`, `job_ref`, timestamps.

The re-fetch is deliberate. The Activepieces resume endpoint is unauthenticated by design
(the resume URL *is* the capability), so a leaked URL can wake the flow but cannot forge
what the flow believes was said. `X-Signature` is not verified — the resume payload is
already-parsed JSON, so the exact signed bytes are not recoverable.

Statuses `transcribed`, `done` and `callback_failed` all carry a transcript and count as
success. Anything else throws, producing a failed step that honours the flow's
`continueOnFailure` / `retryOnFailure` settings.

## Setup

Activepieces side:

| Setting | Value |
| --- | --- |
| `AP_FRONTEND_URL` | this instance's **externally reachable** URL. Left at the localhost default, echoback rejects the submission with `400 CALLBACK_HOST_NOT_ALLOWED`. The piece catches the loopback case before submitting and says so. |
| `AP_WORKER_CONCURRENCY` | pausing releases the worker while transcribing; with the recommended `1`, that is the difference between one voicemail and every flow on the instance stalling. |

Echoback side: `HOST_URL` set to its public URL, `CALLBACK_ALLOWED_HOSTS` containing the
Activepieces host, `WEBHOOK_ATTEMPTS=8`.

## Known limitations

- **Loop On Items is unsupported.** Waitpoints are keyed on `(flowRunId, stepName)`, so a
  second iteration of the same step in the same run may collide with the first. Use one
  run (or a sub-flow) per voicemail.
- **Stranded runs.** If echoback exhausts its ~4¼ minutes of delivery retries (i.e.
  Activepieces was down for longer), the run stays paused until
  `AP_PAUSED_FLOW_TIMEOUT_DAYS` expires. The transcript is still fetchable from
  `GET /jobs/{job_id}` until echoback's retention window (default 60 minutes) closes. A
  flow-level dead-man's switch is the only mitigation.
- **Cross-job confusion (accepted).** Someone holding a leaked resume URL for job A who
  also knows a valid job B can resume A's flow with `job_id: B` and get B's transcript.
  Resume query params come from the request, so there is no trustworthy way to pin the
  submitted job id across the pause.

## License

MIT
