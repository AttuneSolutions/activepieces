import { HttpMethod } from '@activepieces/pieces-common';
import { createAction } from '@activepieces/pieces-framework';
import { yokeAuth } from '../auth';
import {
  flattenInstruction,
  yokeApiCall,
  yokeCommon,
  YokeInstructionShowResponse,
} from '../common';

export const getInstruction = createAction({
  auth: yokeAuth,
  name: 'get_instruction',
  displayName: 'Get Instruction',
  description:
    'Fetches a single Yoke instruction document by ID, including its full Markdown and HTML content.',
  props: {
    instructionId: yokeCommon.instructionDropdown,
  },
  async run(context) {
    const { instructionId } = context.propsValue;
    const accessToken = context.auth.access_token;

    const response = await yokeApiCall<YokeInstructionShowResponse>({
      accessToken,
      method: HttpMethod.GET,
      path: `/instructions/${instructionId}`,
    });

    return flattenInstruction(response.body.document);
  },
});
