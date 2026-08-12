import { createCustomApiCallAction } from '@activepieces/pieces-common';
import {
  createPiece,
  OAuth2PropertyValue,
  PieceCategory,
} from '@activepieces/pieces-framework';
import { getInstruction } from './lib/actions/get-instruction';
import { listInstructions } from './lib/actions/list-instructions';
import { requestApproval } from './lib/actions/request-approval';
import { yokeAuth, YOKE_BASE_URL } from './lib/auth';

export { yokeAuth };

export const yoke = createPiece({
  displayName: 'Yoke',
  description:
    'Read instruction documents from Yoke and gate flows on human approval.',
  auth: yokeAuth,
  minimumSupportedRelease: '0.85.2',
  logoUrl: 'https://www.yokecontrol.ai/piece-yoke.png',
  categories: [PieceCategory.PRODUCTIVITY],
  authors: ['sgsimpson'],
  actions: [
    listInstructions,
    getInstruction,
    requestApproval,
    createCustomApiCallAction({
      baseUrl: () => `${YOKE_BASE_URL}/api/v1`,
      auth: yokeAuth,
      authMapping: async (auth: OAuth2PropertyValue) => ({
        Authorization: `Bearer ${auth.access_token}`,
      }),
    }),
  ],
  triggers: [],
});
