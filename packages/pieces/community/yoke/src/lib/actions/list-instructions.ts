import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { yokeAuth } from '../auth';
import {
  FlatYokeInstruction,
  flattenInstruction,
  yokeApiCall,
  YokeInstructionListResponse,
} from '../common';

export const listInstructions = createAction({
  auth: yokeAuth,
  name: 'list_instructions',
  displayName: 'List Instructions',
  description: 'Lists instruction documents from Yoke, with optional search and tag filters.',
  props: {
    search: Property.ShortText({
      displayName: 'Search',
      description:
        'Filter by title. Returns instructions whose title matches this text.',
      required: false,
    }),
    tag: Property.ShortText({
      displayName: 'Tag',
      description:
        'Filter by a single tag name (e.g. "policy"). Leave empty to return all tags.',
      required: false,
    }),
    perPage: Property.Number({
      displayName: 'Results Per Page',
      description: 'Number of instructions to return per page. Max 100.',
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
        'If enabled, fetches every page and returns all matching instructions in a single result.',
      required: false,
      defaultValue: false,
    }),
  },
  async run(context) {
    const { search, tag, perPage, page, fetchAll } = context.propsValue;
    const accessToken = context.auth.access_token;

    const baseParams: Record<string, string> = {
      per_page: String(Math.min(Math.max(perPage ?? 25, 1), 100)),
    };
    if (search) baseParams['q'] = search;
    if (tag) baseParams['tag'] = tag;

    if (!fetchAll) {
      const response = await yokeApiCall<YokeInstructionListResponse>({
        accessToken,
        method: HttpMethod.GET,
        path: '/instructions',
        queryParams: { ...baseParams, page: String(page ?? 1) },
      });
      return buildListResult(response.body);
    }

    const allRows: FlatYokeInstruction[] = [];
    let currentPage = 1;
    let totalPages = 1;
    let total = 0;
    let perPageEcho = Number(baseParams['per_page']);
    do {
      const response = await yokeApiCall<YokeInstructionListResponse>({
        accessToken,
        method: HttpMethod.GET,
        path: '/instructions',
        queryParams: { ...baseParams, page: String(currentPage) },
      });
      allRows.push(...response.body.documents.map(flattenInstruction));
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

function buildListResult(body: YokeInstructionListResponse) {
  return {
    rows: body.documents.map(flattenInstruction),
    total: body.pagination.total,
    page: body.pagination.page,
    per_page: body.pagination.per_page,
    pages: body.pagination.pages,
  };
}
