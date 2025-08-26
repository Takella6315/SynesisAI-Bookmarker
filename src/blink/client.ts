import { createClient } from '@blinkdotnew/sdk';

export const blink = createClient({
  projectId: 'futuristic-llm-chat--looycqnn',
  authRequired: false,
});

export default blink;
