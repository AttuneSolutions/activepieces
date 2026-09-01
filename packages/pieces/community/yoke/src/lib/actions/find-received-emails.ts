import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { yokeAuth } from '../auth';
import {
  FlatYokeReceivedEmailRow,
  flattenReceivedEmailRow,
  yokeApiCall,
  yokeCommon,
  YokeReceivedEmailListResponse,
} from '../common';

// list-instructions cloned parameter for parameter, including its fetchAll
// do/while. What that costs is named in the spec's §14: an account with 50,000
// messages and no filters is 2,000 sequential API calls inside one step, against
// a 300/minute per-account limit, and neither this action nor the endpoint bounds
// it. Filters first.
export const findReceivedEmails = createAction({
  auth: yokeAuth,
  name: 'find_received_emails',
  displayName: 'Find Received Emails',
  description:
    'Searches the email that has arrived in Yoke agent email inboxes. Returns metadata only - sender, subject, timestamps, attachment counts - newest first. Use Get Received Email to read one.',
  props: {
    inbox: yokeCommon.inboxDropdown,
    search: Property.ShortText({
      displayName: 'Search',
      description:
        'Text to look for in the subject line or the sender address. Matches anywhere in either, case-insensitively.',
      required: false,
    }),
    fromAddress: Property.ShortText({
      displayName: 'From Address',
      description:
        'Exact sender address, case-insensitive. Use Search for a partial match.',
      required: false,
    }),
    since: Property.DateTime({
      displayName: 'Received Since',
      description: 'Only mail received at or after this moment.',
      required: false,
    }),
    until: Property.DateTime({
      displayName: 'Received Until',
      description: 'Only mail received at or before this moment.',
      required: false,
    }),
    // A static dropdown rather than a checkbox, because a checkbox cannot say
    // "no filter": unchecked would send false and silently exclude every message
    // that has an attachment.
    hasAttachments: Property.StaticDropdown({
      displayName: 'Has Attachments',
      description: 'Leave empty for both.',
      required: false,
      options: {
        options: [
          { label: 'With attachments', value: 'true' },
          { label: 'Without attachments', value: 'false' },
        ],
      },
    }),
    // Also a dropdown, and for a sharper reason: Yoke answers an unrecognised
    // value with a 422, so a typed one would fail the step rather than filter.
    webhookStatus: Property.StaticDropdown({
      displayName: 'Webhook Delivery Status',
      description:
        "Yoke's own delivery state for the notification it sent about each message. 'failed' answers \"which mail did we never get told about\".",
      required: false,
      options: {
        options: [
          { label: 'Skipped (no live webhook)', value: 'skipped' },
          { label: 'Pending', value: 'pending' },
          { label: 'Sending', value: 'sending' },
          { label: 'Succeeded', value: 'succeeded' },
          { label: 'Failed', value: 'failed' },
        ],
      },
    }),
    perPage: Property.Number({
      displayName: 'Results Per Page',
      description: 'Number of messages to return per page. Max 100.',
      required: false,
      defaultValue: 25,
    }),
    page: Property.Number({
      displayName: 'Page',
      description: 'Page number to fetch. Ignored when "Fetch All Pages" is on.',
      required: false,
      defaultValue: 1,
    }),
    fetchAll: Property.Checkbox({
      displayName: 'Fetch All Pages',
      description:
        'If enabled, fetches every page and returns all matching messages in a single result. Use filters with this: an unfiltered account with tens of thousands of messages is thousands of sequential calls.',
      required: false,
      defaultValue: false,
    }),
  },
  async run(context) {
    const {
      inbox,
      search,
      fromAddress,
      since,
      until,
      hasAttachments,
      webhookStatus,
      perPage,
      page,
      fetchAll,
    } = context.propsValue;
    const accessToken = context.auth.access_token;

    const baseParams: Record<string, string> = {
      // The clamp that incidentally saves this action from the endpoint's
      // empty-per_page case: it never sends an empty string.
      per_page: String(Math.min(Math.max(perPage ?? 25, 1), 100)),
    };
    if (inbox) baseParams['inbox'] = inbox;
    if (search) baseParams['q'] = search;
    // from_address, not from: the parameter is named that way so it falls inside
    // Yoke's config.filter_parameters and is masked in the archived request line.
    if (fromAddress) baseParams['from_address'] = fromAddress;
    if (since) baseParams['since'] = new Date(since).toISOString();
    if (until) baseParams['until'] = new Date(until).toISOString();
    if (hasAttachments) baseParams['has_attachments'] = hasAttachments;
    if (webhookStatus) baseParams['webhook_status'] = webhookStatus;

    if (!fetchAll) {
      const response = await yokeApiCall<YokeReceivedEmailListResponse>({
        accessToken,
        method: HttpMethod.GET,
        path: '/received_emails',
        queryParams: { ...baseParams, page: String(page ?? 1) },
      });
      return buildListResult(response.body);
    }

    const allRows: FlatYokeReceivedEmailRow[] = [];
    let currentPage = 1;
    let totalPages = 1;
    let total = 0;
    let perPageEcho = Number(baseParams['per_page']);
    do {
      const response = await yokeApiCall<YokeReceivedEmailListResponse>({
        accessToken,
        method: HttpMethod.GET,
        path: '/received_emails',
        queryParams: { ...baseParams, page: String(currentPage) },
      });
      allRows.push(...response.body.received_emails.map(flattenReceivedEmailRow));
      totalPages = response.body.pagination.pages;
      total = response.body.pagination.total;
      perPageEcho = response.body.pagination.per_page;
      currentPage += 1;
    } while (currentPage <= totalPages);

    return {
      rows: allRows,
      total,
      page: 1,
      per_page: perPageEcho,
      pages: totalPages,
    };
  },
});

function buildListResult(body: YokeReceivedEmailListResponse) {
  return {
    rows: body.received_emails.map(flattenReceivedEmailRow),
    total: body.pagination.total,
    page: body.pagination.page,
    per_page: body.pagination.per_page,
    pages: body.pagination.pages,
  };
}
