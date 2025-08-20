import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: 'futuristic-llm-chat--looycqnn',
  authRequired: true
})

export default blink