export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          plan: "free" | "pro";
          created_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          plan?: "free" | "pro";
          created_at?: string | null;
        };
        Update: {
          email?: string;
          plan?: "free" | "pro";
          created_at?: string | null;
        };
      };

      links: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          token: string;
          target_url: string;
          is_active: boolean;
          expires_at: string | null;
          max_opens: number | null;
          opens_count: number;
          password_hash: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string | null;
          token: string;
          target_url: string;
          is_active?: boolean;
          expires_at?: string | null;
          max_opens?: number | null;
          opens_count?: number;
          password_hash?: string | null;
          created_at?: string | null;
        };
        Update: {
          label?: string | null;
          token?: string;
          target_url?: string;
          is_active?: boolean;
          expires_at?: string | null;
          max_opens?: number | null;
          opens_count?: number;
          password_hash?: string | null;
          created_at?: string | null;
        };
      };
    };
  };
}
