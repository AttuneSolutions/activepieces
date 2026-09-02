import { createCustomApiCallAction } from '@activepieces/pieces-common';
import {
  createPiece,
  OAuth2PropertyValue,
  PieceCategory,
} from '@activepieces/pieces-framework';
import { findReceivedEmails } from './lib/actions/find-received-emails';
import { getInstruction } from './lib/actions/get-instruction';
import { getReceivedEmail } from './lib/actions/get-received-email';
import { listInstructions } from './lib/actions/list-instructions';
import { requestApproval } from './lib/actions/request-approval';
import { yokeAuth, YOKE_BASE_URL } from './lib/auth';

export { yokeAuth };

export const yoke = createPiece({
  displayName: 'Yoke',
  description:
    'Read instruction documents and agent email from Yoke, and gate flows on human approval.',
  auth: yokeAuth,
  minimumSupportedRelease: '0.85.2',
  logoUrl: 'https://www.yokecontrol.ai/piece-yoke.png',
  categories: [PieceCategory.PRODUCTIVITY],
  authors: ['sgsimpson'],
  actions: [
    listInstructions,
    getInstruction,
    getReceivedEmail,
    findReceivedEmails,
    requestApproval,
    createCustomApiCallAction({
      baseUrl: () => `${YOKE_BASE_URL}/api/v1`,
      auth: yokeAuth,
      authMapping: async (auth: OAuth2PropertyValue) => ({
        Authorization: `Bearer ${auth.access_token}`,
      }),
    }),
  ],
  // Deliberately empty, and it stays that way. Yoke's per-inbox webhook targets
  // Activepieces' own Catch Webhook, which verifies all three of Yoke's auth
  // modes; a Yoke-branded trigger would verify one, hardcode a header name the
  // operator can change, and still be unable to reject a forgery - the engine
  // answers 200 before a trigger's body runs.
  triggers: [],
});
