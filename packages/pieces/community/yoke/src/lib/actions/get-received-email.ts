import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { yokeAuth } from '../auth';
import {
  flattenReceivedEmail,
  yokeApiCall,
  YokeReceivedEmailShowResponse,
} from '../common';

// The second step, and the reason the flow exists: Yoke's per-inbox webhook
// pushes a metadata-only envelope, and this is what opens the door it rang.
//
// There is deliberately no Yoke trigger. The flow is triggered by Activepieces'
// own Catch Webhook, which Yoke's webhook already targets and which verifies all
// three of Yoke's auth modes (Basic, Header, HMAC). A Yoke-branded trigger could
// not do better: an Activepieces trigger's run() returns unknown[], the engine
// answers HTTP 200 before the body executes, and `return []` on a failed check
// drops the request silently - so it could not reject a forgery, only discard it
// after Yoke had already recorded the delivery as succeeded.
export const getReceivedEmail = createAction({
  auth: yokeAuth,
  name: 'get_received_email',
  displayName: 'Get Received Email',
  description:
    'Fetches the full content of an email that arrived in a Yoke agent email inbox: bodies, headers and attachment list. Use the id from the Catch Webhook trigger payload.',
  props: {
    publicToken: Property.ShortText({
      displayName: 'Email ID',
      description:
        "The rem_... id from the webhook payload. Map this from {{trigger['output'].body.email.id}}.",
      required: true,
    }),
    includeHtml: Property.Checkbox({
      displayName: 'Include HTML Body',
      description:
        'Include the HTML body in the result. Turn this off when the flow only reads the plain text - the HTML body is routinely much larger.',
      required: false,
      defaultValue: true,
    }),
  },
  async run(context) {
    const { publicToken, includeHtml } = context.propsValue;

    const response = await yokeApiCall<YokeReceivedEmailShowResponse>({
      accessToken: context.auth.access_token,
      method: HttpMethod.GET,
      // encodeURIComponent because yokeApiCall builds the URL by template
      // interpolation and this value is mapped from a payload the flow author can
      // point anywhere. get-instruction gets away without it: its value comes
      // from a dropdown of integers.
      path: `/received_emails/${encodeURIComponent(publicToken)}`,
    });

    // The 410 is not caught. httpClient throws on a non-2xx and content_expired
    // is a real answer - the raw message was incinerated 30 days after arrival.
    // Returning { expired: true } instead was considered and rejected: a silent
    // empty result is how a flow posts a blank invoice. Use Activepieces'
    // continue-on-failure and {{step['error']}} when a 31-day-old message is
    // expected.
    return flattenReceivedEmail(response.body.received_email, {
      includeHtml: includeHtml ?? true,
    });
  },
});
