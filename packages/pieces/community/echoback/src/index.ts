import { PieceCategory, createPiece } from '@activepieces/pieces-framework';
import { transcribeAndWait } from './lib/actions/transcribe-and-wait';
import { echobackAuth } from './lib/auth';

export { echobackAuth };

export const echoback = createPiece({
  displayName: 'Echoback',
  description: 'Transcribe voicemail audio with a self-hosted echoback service.',
  auth: echobackAuth,
  minimumSupportedRelease: '0.36.1',
  logoUrl: 'https://raw.githubusercontent.com/AttuneSolutions/echoback/main/docs/logo.png',
  categories: [PieceCategory.PRODUCTIVITY],
  authors: ['sgsimpson'],
  actions: [transcribeAndWait],
  triggers: [],
});
