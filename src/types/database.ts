export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          stripe_customer_id: string | null;
          credits: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          stripe_customer_id?: string | null;
          credits?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          stripe_customer_id?: string | null;
          credits?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      generation_jobs: {
        Row: {
          id: string;
          user_id: string;
          status: "queued" | "analyzing" | "generating" | "completed" | "failed";
          scene: string;
          style: string;
          aspect_ratio: string;
          prompt: string | null;
          final_prompt: string | null;
          source_path: string | null;
          output_path: string | null;
          output_url: string | null;
          fal_request_id: string | null;
          error: string | null;
          cost_cents: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: "queued" | "analyzing" | "generating" | "completed" | "failed";
          scene: string;
          style: string;
          aspect_ratio: string;
          prompt?: string | null;
          final_prompt?: string | null;
          source_path?: string | null;
          output_path?: string | null;
          output_url?: string | null;
          fal_request_id?: string | null;
          error?: string | null;
          cost_cents?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "queued" | "analyzing" | "generating" | "completed" | "failed";
          prompt?: string | null;
          final_prompt?: string | null;
          source_path?: string | null;
          output_path?: string | null;
          output_url?: string | null;
          fal_request_id?: string | null;
          error?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      credit_ledger: {
        Row: {
          id: string;
          user_id: string;
          job_id: string | null;
          stripe_checkout_session_id: string | null;
          type: "grant" | "purchase" | "usage" | "refund";
          amount: number;
          balance_after: number;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_id?: string | null;
          stripe_checkout_session_id?: string | null;
          type: "grant" | "purchase" | "usage" | "refund";
          amount: number;
          balance_after: number;
          description: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      stripe_events: {
        Row: {
          id: string;
          type: string;
          payload: Json;
          processed_at: string;
        };
        Insert: {
          id: string;
          type: string;
          payload: Json;
          processed_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_credit_for_generation: {
        Args: {
          p_user_id: string;
          p_job_id: string;
          p_description: string;
          p_cost?: number;
        };
        Returns: number;
      };
      refund_credit_for_failed_generation: {
        Args: {
          p_user_id: string;
          p_job_id: string;
          p_description: string;
          p_amount?: number;
        };
        Returns: number;
      };
      grant_purchased_credits: {
        Args: {
          p_user_id: string;
          p_session_id: string;
          p_amount: number;
          p_description: string;
          p_event_id: string;
          p_event_type: string;
          p_payload: Json;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
