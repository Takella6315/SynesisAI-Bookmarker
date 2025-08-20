import { LLMModelInfo } from '../types'

export const LLM_MODELS: LLMModelInfo[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    description: 'Fast and efficient for most tasks'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI', 
    description: 'Most capable OpenAI model'
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Excellent for analysis and reasoning'
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    description: 'Fast multimodal capabilities'
  }
]