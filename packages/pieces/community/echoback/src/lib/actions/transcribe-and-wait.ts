import { ExecutionType, Property, createAction } from '@activepieces/pieces-framework';
import { echobackAuth } from '../auth';
import { EchobackAuthValue, echobackApi } from '../common';

export const transcribeAndWait = createAction({
  auth: echobackAuth,
  name: 'transcribe_and_wait',
  displayName: 'Transcribe Voicemail and Wait',
  description: 'Submit audio to echoback, pause until transcribed, return the transcript.',
  props: {
    instructions: Property.MarkDown({
      value: `This step **pauses** the flow while echoback transcribes, then resumes when echoback calls back. Paused time does not count against the flow timeout and the worker is released while waiting.

Requires \`AP_FRONTEND_URL\` to be set to this instance's externally reachable URL — echoback refuses loopback callback targets.

**Not supported inside Loop On Items:** one waitpoint exists per step per run, so a second iteration may collide with the first. Use a sub-flow per voicemail instead.`,
    }),
    file: Property.File({
      displayName: 'Audio',
      description: 'Voicemail audio in any codec ffmpeg decodes. Max 25 MB by default.',
      required: true,
    }),
    jobRef: Property.ShortText({
      displayName: 'Correlation Ref',
      description: 'Echoed back verbatim. Max 256 characters, no control characters.',
      required: false,
    }),
    model: Property.ShortText({
      displayName: 'Model Override',
      description: 'Must be in the server\'s allowlist, e.g. tiny, base, small, medium or their .en variants. Leave empty for the server default.',
      required: false,
    }),
    vocabularyHint: Property.LongText({
      displayName: 'Vocabulary Hint',
      description: 'Domain terms and expected proper nouns to bias decoding. Max 1000 characters.',
      required: false,
    }),
  },

  async run(context) {
    const auth: EchobackAuthValue = context.auth.props;
    const { propsValue } = context;

    if (context.executionType === ExecutionType.BEGIN) {
      const waitpoint = await context.run.createWaitpoint({ type: 'WEBHOOK' });
      const callbackUrl = waitpoint.buildResumeUrl({ queryParams: {} });

      const submission = await echobackApi.submitJob({
        auth,
        callbackUrl,
        file: propsValue.file,
        jobRef: propsValue.jobRef,
        model: propsValue.model,
        vocabularyHint: propsValue.vocabularyHint,
      });

      context.run.waitForWaitpoint(waitpoint.id);
      return submission;
    }

    const jobId = echobackApi.readJobIdFromCallback(context.resumePayload.body);
    const job = await echobackApi.fetchJob({ auth, jobId });
    return echobackApi.assertTranscriptDelivered(job);
  },
});
