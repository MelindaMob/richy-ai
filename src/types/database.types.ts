export type SubscriptionStatus = 
  | 'trialing'
  | 'active' 
  | 'canceled'
  | 'expired'
  | 'past_due'

export type AgentType = 'chat' | 'validator' | 'prompt' | 'builder'

export interface Profile {
  id: string
  email: string
  full_name?: string
  company_name?: string
  subscription_status: SubscriptionStatus
  trial_ends_at?: string
  subscription_ends_at?: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  agent_type: AgentType
  title?: string
  input_data: any
  output_data: any
  tokens_used?: number
  processing_time_ms?: number
  created_at: string
}