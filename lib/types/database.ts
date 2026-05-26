export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      content_likes: {
        Row: {
          client_id: string
          created_at: string
          creator_id: string
          id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          creator_id: string
          id?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          creator_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_likes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_likes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
          {
            foreignKeyName: "content_likes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_likes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          profile_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          profile_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_group: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_group?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_group?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coupon_usage: {
        Row: {
          call_id: string | null
          coupon_id: string
          id: string
          purchase_id: string | null
          ticket_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          call_id?: string | null
          coupon_id: string
          id?: string
          purchase_id?: string | null
          ticket_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          call_id?: string | null
          coupon_id?: string
          id?: string
          purchase_id?: string | null
          ticket_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
          {
            foreignKeyName: "fk_call_coupon"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "one_on_one_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_purchase_coupon"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "pack_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ticket_coupon"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "live_stream_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applicable_call_id: string | null
          applicable_live_id: string | null
          applicable_pack_id: string | null
          code: string
          created_at: string | null
          description: string | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          id: string
          image_url: string | null
          max_uses: number | null
          scope: Database["public"]["Enums"]["coupon_scope"]
          store_name: string | null
          usage_count: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_call_id?: string | null
          applicable_live_id?: string | null
          applicable_pack_id?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          id?: string
          image_url?: string | null
          max_uses?: number | null
          scope: Database["public"]["Enums"]["coupon_scope"]
          store_name?: string | null
          usage_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_call_id?: string | null
          applicable_live_id?: string | null
          applicable_pack_id?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number
          id?: string
          image_url?: string | null
          max_uses?: number | null
          scope?: Database["public"]["Enums"]["coupon_scope"]
          store_name?: string | null
          usage_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      creator_availability: {
        Row: {
          availability_date: string
          created_at: string | null
          creator_id: string
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          availability_date: string
          created_at?: string | null
          creator_id: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          availability_date?: string
          created_at?: string | null
          creator_id?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_availability_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_availability_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      creator_availability_slots: {
        Row: {
          availability_id: string
          id: string
          period_of_day: Database["public"]["Enums"]["period_of_day"]
          purchased: boolean | null
          slot_time: string
        }
        Insert: {
          availability_id: string
          id?: string
          period_of_day: Database["public"]["Enums"]["period_of_day"]
          purchased?: boolean | null
          slot_time: string
        }
        Update: {
          availability_id?: string
          id?: string
          period_of_day?: Database["public"]["Enums"]["period_of_day"]
          purchased?: boolean | null
          slot_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_availability_slots_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "creator_availability"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_description: {
        Row: {
          adoro: string
          cidade: string
          created_at: string
          date_birth: string | null
          eu_sou: string
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          idade: number
          me_considero: string
          pessoas_que: string
          por: string
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          adoro?: string
          cidade: string
          created_at?: string
          date_birth?: string | null
          eu_sou?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          idade: number
          me_considero?: string
          pessoas_que?: string
          por?: string
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          adoro?: string
          cidade?: string
          created_at?: string
          date_birth?: string | null
          eu_sou?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          idade?: number
          me_considero?: string
          pessoas_que?: string
          por?: string
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "description_creator_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "description_creator_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      creator_favorites: {
        Row: {
          client_id: string
          created_at: string
          creator_id: string
          id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          creator_id: string
          id?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          creator_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
          {
            foreignKeyName: "fk_creator"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_creator"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      creator_notification_settings: {
        Row: {
          client_id: string
          created_at: string | null
          creator_id: string
          id: string
          notify_live_scheduled: boolean | null
          notify_live_started: boolean | null
          notify_new_content: boolean | null
          notify_online: boolean | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          creator_id: string
          id?: string
          notify_live_scheduled?: boolean | null
          notify_live_started?: boolean | null
          notify_new_content?: boolean | null
          notify_online?: boolean | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          creator_id?: string
          id?: string
          notify_live_scheduled?: boolean | null
          notify_live_started?: boolean | null
          notify_new_content?: boolean | null
          notify_online?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_notification_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_notification_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
          {
            foreignKeyName: "creator_notification_settings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_notification_settings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      creator_payout_info: {
        Row: {
          account_details: Json
          created_at: string | null
          creator_id: string
          payout_method: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          account_details: Json
          created_at?: string | null
          creator_id: string
          payout_method: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_details?: Json
          created_at?: string | null
          creator_id?: string
          payout_method?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_payout_info_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_payout_info_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      creator_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          cancelled_at: string | null
          created_at: string | null
          creator_id: string
          current_period_end: string
          current_period_start: string
          gateway_subscription_id: string | null
          id: string
          plan_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          created_at?: string | null
          creator_id: string
          current_period_end: string
          current_period_start: string
          gateway_subscription_id?: string | null
          id?: string
          plan_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          created_at?: string | null
          creator_id?: string
          current_period_end?: string
          current_period_start?: string
          gateway_subscription_id?: string | null
          id?: string
          plan_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_subscriptions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_subscriptions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
          {
            foreignKeyName: "creator_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_tickets: {
        Row: {
          coupon_used_id: string | null
          creator_share: number | null
          currency: string
          id: string
          live_stream_id: string
          platform_fee: number | null
          purchase_price: number
          purchased_at: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          coupon_used_id?: string | null
          creator_share?: number | null
          currency?: string
          id?: string
          live_stream_id: string
          platform_fee?: number | null
          purchase_price: number
          purchased_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          coupon_used_id?: string | null
          creator_share?: number | null
          currency?: string
          id?: string
          live_stream_id?: string
          platform_fee?: number | null
          purchase_price?: number
          purchased_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_coupon_used_id_ticket"
            columns: ["coupon_used_id"]
            isOneToOne: false
            referencedRelation: "coupon_usage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_transaction_id_ticket"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_tickets_live_stream_id_fkey"
            columns: ["live_stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      live_streams: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          cover_image_url: string | null
          created_at: string | null
          creator_id: string
          currency: string
          description: string | null
          estimated_duration_minutes: number | null
          id: string
          participant_limit: number | null
          scheduled_start_time: string
          status: Database["public"]["Enums"]["live_stream_status"]
          stream_url: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          ticket_price: number
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          creator_id: string
          currency?: string
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          participant_limit?: number | null
          scheduled_start_time: string
          status?: Database["public"]["Enums"]["live_stream_status"]
          stream_url?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          ticket_price: number
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          creator_id?: string
          currency?: string
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          participant_limit?: number | null
          scheduled_start_time?: string
          status?: Database["public"]["Enums"]["live_stream_status"]
          stream_url?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          ticket_price?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_streams_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          message: string
          read_at: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message: string
          read_at?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      one_on_one_calls: {
        Row: {
          accepted_at: string | null
          actual_end_time: string | null
          actual_start_time: string | null
          availability_slot_id: string | null
          call_price: number
          coupon_used_id: string | null
          created_at: string | null
          creator_id: string
          creator_share: number | null
          currency: string
          expires_at: string | null
          id: string
          paid_at: string | null
          platform_fee: number | null
          rejected_at: string | null
          request_flow: boolean
          scheduled_duration_minutes: number
          scheduled_end_time: string | null
          scheduled_start_time: string | null
          status: Database["public"]["Enums"]["one_on_one_call_status"]
          transaction_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          actual_end_time?: string | null
          actual_start_time?: string | null
          availability_slot_id?: string | null
          call_price: number
          coupon_used_id?: string | null
          created_at?: string | null
          creator_id: string
          creator_share?: number | null
          currency: string
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          platform_fee?: number | null
          rejected_at?: string | null
          request_flow?: boolean
          scheduled_duration_minutes: number
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          status?: Database["public"]["Enums"]["one_on_one_call_status"]
          transaction_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          actual_end_time?: string | null
          actual_start_time?: string | null
          availability_slot_id?: string | null
          call_price?: number
          coupon_used_id?: string | null
          created_at?: string | null
          creator_id?: string
          creator_share?: number | null
          currency?: string
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          platform_fee?: number | null
          rejected_at?: string | null
          request_flow?: boolean
          scheduled_duration_minutes?: number
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          status?: Database["public"]["Enums"]["one_on_one_call_status"]
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_coupon_used_id_call"
            columns: ["coupon_used_id"]
            isOneToOne: false
            referencedRelation: "coupon_usage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_transaction_id_call"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_calls_availability_slot_id_fkey"
            columns: ["availability_slot_id"]
            isOneToOne: false
            referencedRelation: "creator_availability_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_calls_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_calls_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
          {
            foreignKeyName: "one_on_one_calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      pack_items: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_size_bytes: number | null
          file_url: string
          id: string
          item_order: number | null
          item_type: Database["public"]["Enums"]["pack_item_type"]
          pack_id: string
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url: string
          id?: string
          item_order?: number | null
          item_type: Database["public"]["Enums"]["pack_item_type"]
          pack_id: string
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          item_order?: number | null
          item_type?: Database["public"]["Enums"]["pack_item_type"]
          pack_id?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_items_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_purchases: {
        Row: {
          coupon_used_id: string | null
          creator_share: number | null
          currency: string
          id: string
          pack_id: string
          platform_fee: number | null
          purchase_price: number
          purchased_at: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          coupon_used_id?: string | null
          creator_share?: number | null
          currency: string
          id?: string
          pack_id: string
          platform_fee?: number | null
          purchase_price: number
          purchased_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          coupon_used_id?: string | null
          creator_share?: number | null
          currency?: string
          id?: string
          pack_id?: string
          platform_fee?: number | null
          purchase_price?: number
          purchased_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_coupon_used_id"
            columns: ["coupon_used_id"]
            isOneToOne: false
            referencedRelation: "coupon_usage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_transaction_id"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_purchases_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      packs: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          currency: string
          description: string | null
          id: string
          price: number
          profile_id: string
          published_at: string | null
          status: Database["public"]["Enums"]["content_pack_status"]
          stripe_price_id: string | null
          stripe_product_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          price: number
          profile_id: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["content_pack_status"]
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          price?: number
          profile_id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["content_pack_status"]
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          creator_id: string
          currency: string
          id: string
          idempotency_key: string | null
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          requested_at: string | null
          status: Database["public"]["Enums"]["payout_status"]
          transaction_reference: string | null
        }
        Insert: {
          amount: number
          creator_id: string
          currency: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          transaction_reference?: string | null
        }
        Update: {
          amount?: number
          creator_id?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
          {
            foreignKeyName: "payouts_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      processed_webhook_events: {
        Row: {
          created_at: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      profile_documents: {
        Row: {
          back_image_url: string
          created_at: string
          front_image_url: string
          id: string
          number: string | null
          profile_id: string
          type: string
        }
        Insert: {
          back_image_url: string
          created_at?: string
          front_image_url: string
          id?: string
          number?: string | null
          profile_id: string
          type: string
        }
        Update: {
          back_image_url?: string
          created_at?: string
          front_image_url?: string
          id?: string
          number?: string | null
          profile_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      profile_images: {
        Row: {
          created_at: string
          highlight_image_url: boolean
          id: string
          image_url: string
          index: number | null
          profile_id: string
        }
        Insert: {
          created_at?: string
          highlight_image_url?: boolean
          id?: string
          image_url: string
          index?: number | null
          profile_id: string
        }
        Update: {
          created_at?: string
          highlight_image_url?: boolean
          id?: string
          image_url?: string
          index?: number | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_images_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_images_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      profile_settings: {
        Row: {
          call_per_1_hr: number
          call_per_30_min: number
          created_at: string
          face_to_face_meeting: boolean
          id: string
          profile_id: string
          sell_calls: boolean
          sell_packs: boolean
          sell_stream: boolean
        }
        Insert: {
          call_per_1_hr?: number
          call_per_30_min?: number
          created_at?: string
          face_to_face_meeting?: boolean
          id?: string
          profile_id: string
          sell_calls?: boolean
          sell_packs?: boolean
          sell_stream?: boolean
        }
        Update: {
          call_per_1_hr?: number
          call_per_30_min?: number
          created_at?: string
          face_to_face_meeting?: boolean
          id?: string
          profile_id?: string
          sell_calls?: boolean
          sell_packs?: boolean
          sell_stream?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profile_settings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_settings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      profile_views: {
        Row: {
          id: string
          profile_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      profiles: {
        Row: {
          aprove: string | null
          avatar_url: string | null
          created_at: string | null
          date_birth: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          is_available_for_calls: boolean
          last_seen_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          username: string | null
          whatsapp: string | null
        }
        Insert: {
          aprove?: string | null
          avatar_url?: string | null
          created_at?: string | null
          date_birth?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          is_available_for_calls?: boolean
          last_seen_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          username?: string | null
          whatsapp?: string | null
        }
        Update: {
          aprove?: string | null
          avatar_url?: string | null
          created_at?: string | null
          date_birth?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          is_available_for_calls?: boolean
          last_seen_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          username?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      creator_presence: {
        Row: {
          creator_id: string
          last_heartbeat_at: string
          online: boolean
          source: string
          updated_at: string
        }
        Insert: {
          creator_id: string
          last_heartbeat_at?: string
          online?: boolean
          source?: string
          updated_at?: string
        }
        Update: {
          creator_id?: string
          last_heartbeat_at?: string
          online?: boolean
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_presence_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          currency: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price_monthly: number
          price_yearly: number | null
          stripe_price_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price_monthly: number
          price_yearly?: number | null
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          gateway: string
          gateway_transaction_id: string | null
          id: string
          related_call_id: string | null
          related_purchase_id: string | null
          related_ticket_id: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency: string
          gateway: string
          gateway_transaction_id?: string | null
          id?: string
          related_call_id?: string | null
          related_purchase_id?: string | null
          related_ticket_id?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          gateway?: string
          gateway_transaction_id?: string | null
          id?: string
          related_call_id?: string | null
          related_purchase_id?: string | null
          related_ticket_id?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_related_call"
            columns: ["related_call_id"]
            isOneToOne: false
            referencedRelation: "one_on_one_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_related_purchase"
            columns: ["related_purchase_id"]
            isOneToOne: false
            referencedRelation: "pack_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_related_ticket"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "live_stream_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
    }
    Views: {
      total_gasto_cliente: {
        Row: {
          total_amount: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      vw_creator_conversations: {
        Row: {
          conversation_id: string | null
          last_message: string | null
          last_message_created_at: string | null
          last_message_read_by_client: boolean | null
          last_message_time: string | null
          peer_avatar_url: string | null
          peer_id: string | null
          peer_name: string | null
          profile_id: string | null
          profile_last_read_at: string | null
          unread_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      vw_creator_events: {
        Row: {
          attendee_count: number | null
          creator_id: string | null
          duration_min: number | null
          event_id: string | null
          event_name: string | null
          event_type: string | null
          start_date: string | null
          ticket_price: number | null
          time: string | null
          title: string | null
        }
        Relationships: []
      }
      vw_messages: {
        Row: {
          client_id: string | null
          client_last_read_at: string | null
          content: string | null
          conversation_id: string | null
          created_at: string | null
          is_read_by_client: boolean | null
          is_read_by_creator: boolean | null
          message_id: string | null
          sender_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "vw_creator_conversations"
            referencedColumns: ["peer_id"]
          },
        ]
      }
    }
    Functions: {
      fn_create_call_request: {
        Args: { p_creator_id: string; p_duration_minutes: number }
        Returns: Database["public"]["Tables"]["one_on_one_calls"]["Row"]
      }
      fn_expire_pending_calls: { Args: never; Returns: number }
      fn_mark_call_started: { Args: { p_call_id: string }; Returns: string }
      fn_mark_live_started: { Args: { p_live_stream_id: string }; Returns: string }
      create_pack_with_items: { Args: { p_payload: Json }; Returns: Json }
      get_available_coupons: { Args: never; Returns: Json }
      get_client_info: { Args: { p_profile_id: string }; Returns: Json }
      get_creator_availability_json: {
        Args: { p_creator_id: string }
        Returns: Json
      }
      get_creator_daily_slots: {
        Args: { p_creator_id: string; p_date: string }
        Returns: Json
      }
      get_creator_details: {
        Args: { p_client_id: string; p_profile_id: string }
        Returns: Json
      }
      get_creator_metrics: { Args: { p_profile_id: string }; Returns: Json }
      get_creator_monthly_revenue: {
        Args: { p_creator_id: string; p_month: number; p_year: number }
        Returns: Json
      }
      get_creators_status: { Args: never; Returns: Json }
      get_pack_with_items: { Args: { p_pack_id: string }; Returns: Json }
      get_packs_by_creator: {
        Args: {
          p_creator_id: string
          p_end_date?: string
          p_has_photo?: string
          p_has_video?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_profile_info: { Args: { p_profile_id: string }; Returns: Json }
      get_user_purchases_json: { Args: { p_user_id: string }; Returns: Json }
      list_creator_conversations: {
        Args: { p_creator_id: string }
        Returns: Json
      }
      save_creator_availability: {
        Args: {
          p_availability_date: string
          p_creator_id: string
          p_slots: Json
        }
        Returns: Json
      }
      save_profile_info: { Args: { p_payload: Json }; Returns: Json }
      toggle_creator_favorite: { Args: { p_creator_id: string }; Returns: Json }
      toggle_creator_like: { Args: { p_creator_id: string }; Returns: Json }
      update_pack_with_items: { Args: { p_payload: Json }; Returns: Json }
      upsert_profile_images: {
        Args: { p_images: Json; p_profile_id: string }
        Returns: undefined
      }
    }
    Enums: {
      content_pack_status: "draft" | "published" | "archived" | "rejected"
      coupon_discount_type: "percentage" | "fixed_amount"
      coupon_scope:
        | "all_packs"
        | "specific_pack"
        | "all_lives"
        | "specific_live"
        | "all_calls"
        | "specific_call"
        | "platform_wide"
      gender: "Homem" | "Mulher" | "Não binário"
      live_stream_status: "scheduled" | "live" | "finished" | "cancelled"
      one_on_one_call_status:
        | "requested"
        | "confirmed"
        | "completed"
        | "cancelled_by_user"
        | "cancelled_by_creator"
        | "rejected"
        | "awaiting_payment"
        | "paid"
        | "expired"
      pack_item_type: "photo" | "video"
      payout_status: "pending" | "processing" | "completed" | "failed"
      period_of_day: "Manhã" | "Tarde" | "Noite" | "Madrugada"
      purchase_status: "pending" | "completed" | "failed" | "refunded"
      user_role: "consumer" | "creator" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      content_pack_status: ["draft", "published", "archived", "rejected"],
      coupon_discount_type: ["percentage", "fixed_amount"],
      coupon_scope: [
        "all_packs",
        "specific_pack",
        "all_lives",
        "specific_live",
        "all_calls",
        "specific_call",
        "platform_wide",
      ],
      gender: ["Homem", "Mulher", "Não binário"],
      live_stream_status: ["scheduled", "live", "finished", "cancelled"],
      one_on_one_call_status: [
        "requested",
        "confirmed",
        "completed",
        "cancelled_by_user",
        "cancelled_by_creator",
        "rejected",
        "awaiting_payment",
        "paid",
        "expired",
      ],
      pack_item_type: ["photo", "video"],
      payout_status: ["pending", "processing", "completed", "failed"],
      period_of_day: ["Manhã", "Tarde", "Noite", "Madrugada"],
      purchase_status: ["pending", "completed", "failed", "refunded"],
      user_role: ["consumer", "creator", "admin"],
    },
  },
} as const

// ─── Custom App Types (non-generated) ─────────────────────────────────────────

export type TypeNotification = 'Sucesso' | 'Alerta' | 'Erro' | 'Informacao'
export type PaginaSelect =
  | 'Conteudo'
  | 'Cupons'
  | 'Suporte'
  | 'Perfil'
  | 'Home'
  | 'Agenda'
  | 'Chat'
  | 'Notificacoes'
  | 'Empty'
export type TypeEventos = 'live' | 'call'
export type DiscountType = 'percentage' | 'fixed'
export type UserRole = 'creator' | 'client' | 'admin'
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing'

export interface ProfileCreator {
  username: string
  full_name: string
  avatar_url: string
  role: UserRole
  is_active: boolean
  is_available_for_calls?: boolean
  last_seen_at?: string | null
  created_at: string
  updated_at: string
  whatsapp: string
}

export interface CreatorDescription {
  idade: number | null
  date_birth: string | null
  cidade: string | null
  eu_sou: string | null
  por: string | null
  me_considero: string | null
  adoro: string | null
  pessoas_que: string | null
  gender: string | null
  created_at: string
  updated_at: string
}

export interface BankAccount {
  id: string
  last4: string
  status: string
  country: string
  currency: string
  bank_name: string
  routing_number: string
  default_for_currency: boolean
}

export interface AccountDetails {
  bank_account: BankAccount | null
  last_synced_at: string
  charges_enabled: boolean
  payouts_enabled: boolean
  stripe_account_id: string
}

export interface ImagesCreator {
  highlight_image_url: boolean
  image_url: string
}

export interface CreatorData {
  profile: ProfileCreator
  creator_description: CreatorDescription | null
  images: ImagesCreator[]
  plan_name: string | null
  has_active_plan: boolean
  plan_stripe_id: string | null
  account_details: AccountDetails | null
}

export interface PacksData {
  pack_id: string
  cover_image_url: string
  title: string
  price: number
  photo_count: number
  video_count: number
}

export interface CouponData {
  id: string
  code: string
  image_url: string
  valid_from: string
  valid_until: string
  description: string
  discount_type: DiscountType
  discount_value: number
  store_name: string
}

export interface RevenueBreakdown {
  live_revenue: number
  call_revenue: number
  content_revenue: number
  subscription_revenue: number
}

export interface StatementData {
  revenue_breakdown: RevenueBreakdown
  available_for_payout: number
  future_payouts: number
  completed_payouts: number
}

export interface TimeSlot {
  id: string
  slot_time: string
  period_of_day: string
  purchased: boolean
}

export interface AvailabilityData {
  date: string
  slots: TimeSlot[]
}

export interface LoginData {
  email: string
  password: string
  remember: boolean
}
