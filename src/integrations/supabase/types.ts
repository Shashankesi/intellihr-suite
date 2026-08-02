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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          description: string | null
          employee_id: string | null
          id: string
          kind: string
          metadata: Json
          title: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          id?: string
          kind?: string
          metadata?: Json
          title: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          id?: string
          kind?: string
          metadata?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          author_id: string | null
          body: string
          created_at: string
          expires_at: string | null
          id: string
          pinned: boolean
          priority: string
          publish_at: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          author_id?: string | null
          body?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          pinned?: boolean
          priority?: string
          publish_at?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          author_id?: string | null
          body?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          pinned?: boolean
          priority?: string
          publish_at?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          work_date: string
          worked_minutes: number
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_date?: string
          worked_minutes?: number
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_date?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          allow_self_attendance: boolean
          company_name: string
          created_at: string
          currency: string
          default_casual_leave: number
          default_earned_leave: number
          default_sick_leave: number
          fiscal_year_start: number
          id: string
          late_grace_minutes: number
          legal_name: string | null
          logo_url: string | null
          phone: string | null
          require_leave_approval: boolean
          singleton: boolean
          support_email: string | null
          timezone: string
          updated_at: string
          website: string | null
          work_days: number[]
          work_end: string
          work_start: string
        }
        Insert: {
          address?: string | null
          allow_self_attendance?: boolean
          company_name?: string
          created_at?: string
          currency?: string
          default_casual_leave?: number
          default_earned_leave?: number
          default_sick_leave?: number
          fiscal_year_start?: number
          id?: string
          late_grace_minutes?: number
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          require_leave_approval?: boolean
          singleton?: boolean
          support_email?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
          work_days?: number[]
          work_end?: string
          work_start?: string
        }
        Update: {
          address?: string | null
          allow_self_attendance?: boolean
          company_name?: string
          created_at?: string
          currency?: string
          default_casual_leave?: number
          default_earned_leave?: number
          default_sick_leave?: number
          fiscal_year_start?: number
          id?: string
          late_grace_minutes?: number
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          require_leave_approval?: boolean
          singleton?: boolean
          support_email?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
          work_days?: number[]
          work_end?: string
          work_start?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          budget: number
          code: string
          created_at: string
          description: string | null
          head_employee_id: string | null
          id: string
          location: string | null
          name: string
          updated_at: string
        }
        Insert: {
          budget?: number
          code: string
          created_at?: string
          description?: string | null
          head_employee_id?: string | null
          id?: string
          location?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          budget?: number
          code?: string
          created_at?: string
          description?: string | null
          head_employee_id?: string | null
          id?: string
          location?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_head_fk"
            columns: ["head_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          content: string | null
          created_at: string
          employee_id: string | null
          file_name: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          owner_id: string
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string
          employee_id?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          owner_id: string
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          employee_id?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          owner_id?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          avatar_url: string | null
          base_salary: number
          created_at: string
          date_of_birth: string | null
          date_of_joining: string
          department_id: string | null
          designation: string
          email: string
          emergency_contact: string | null
          employee_code: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          first_name: string
          gender: string | null
          id: string
          last_name: string
          location: string | null
          manager_id: string | null
          phone: string | null
          skills: string[]
          status: Database["public"]["Enums"]["employment_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          base_salary?: number
          created_at?: string
          date_of_birth?: string | null
          date_of_joining?: string
          department_id?: string | null
          designation?: string
          email: string
          emergency_contact?: string | null
          employee_code: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          location?: string | null
          manager_id?: string | null
          phone?: string | null
          skills?: string[]
          status?: Database["public"]["Enums"]["employment_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          base_salary?: number
          created_at?: string
          date_of_birth?: string | null
          date_of_joining?: string
          department_id?: string | null
          designation?: string
          email?: string
          emergency_contact?: string | null
          employee_code?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          location?: string | null
          manager_id?: string | null
          phone?: string | null
          skills?: string[]
          status?: Database["public"]["Enums"]["employment_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          description: string | null
          employee_id: string
          id: string
          progress: number
          status: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          employee_id: string
          id?: string
          progress?: number
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          employee_id?: string
          id?: string
          progress?: number
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          description: string | null
          holiday_date: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          holiday_date: string
          id?: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          holiday_date?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          created_at: string
          employee_id: string
          entitled: number
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          updated_at: string
          used: number
          year: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          entitled?: number
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
          used?: number
          year?: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          entitled?: number
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
          used?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          ai_classification: string | null
          ai_recommendation: string | null
          created_at: string
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
        }
        Insert: {
          ai_classification?: string | null
          ai_recommendation?: string | null
          created_at?: string
          days?: number
          employee_id: string
          end_date: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Update: {
          ai_classification?: string | null
          ai_recommendation?: string | null
          created_at?: string
          days?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payroll: {
        Row: {
          allowances: number
          basic: number
          bonus: number
          created_at: string
          deductions: number
          employee_id: string
          hra: number
          id: string
          net_pay: number
          paid_on: string | null
          period_month: number
          period_year: number
          status: Database["public"]["Enums"]["payroll_status"]
          tax: number
          updated_at: string
        }
        Insert: {
          allowances?: number
          basic?: number
          bonus?: number
          created_at?: string
          deductions?: number
          employee_id: string
          hra?: number
          id?: string
          net_pay?: number
          paid_on?: string | null
          period_month: number
          period_year: number
          status?: Database["public"]["Enums"]["payroll_status"]
          tax?: number
          updated_at?: string
        }
        Update: {
          allowances?: number
          basic?: number
          bonus?: number
          created_at?: string
          deductions?: number
          employee_id?: string
          hra?: number
          id?: string
          net_pay?: number
          paid_on?: string | null
          period_month?: number
          period_year?: number
          status?: Database["public"]["Enums"]["payroll_status"]
          tax?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          ai_generated: boolean
          created_at: string
          employee_id: string
          id: string
          improvements: string | null
          period: string
          rating: number
          reviewer_id: string | null
          strengths: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          created_at?: string
          employee_id: string
          id?: string
          improvements?: string | null
          period: string
          rating?: number
          reviewer_id?: string | null
          strengths?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          created_at?: string
          employee_id?: string
          id?: string
          improvements?: string | null
          period?: string
          rating?: number
          reviewer_id?: string | null
          strengths?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          job_title: string | null
          locale: string
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          job_title?: string | null
          locale?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          locale?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_employee_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      redeem_invite_code: {
        Args: { _code: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role: "admin" | "hr" | "employee"
      attendance_status:
        | "present"
        | "late"
        | "absent"
        | "half_day"
        | "remote"
        | "holiday"
      employment_status:
        | "active"
        | "probation"
        | "notice"
        | "terminated"
        | "on_leave"
      employment_type: "full_time" | "part_time" | "contract" | "intern"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      leave_type:
        | "casual"
        | "sick"
        | "earned"
        | "unpaid"
        | "maternity"
        | "paternity"
        | "bereavement"
      payroll_status: "draft" | "processed" | "paid"
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
      app_role: ["admin", "hr", "employee"],
      attendance_status: [
        "present",
        "late",
        "absent",
        "half_day",
        "remote",
        "holiday",
      ],
      employment_status: [
        "active",
        "probation",
        "notice",
        "terminated",
        "on_leave",
      ],
      employment_type: ["full_time", "part_time", "contract", "intern"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: [
        "casual",
        "sick",
        "earned",
        "unpaid",
        "maternity",
        "paternity",
        "bereavement",
      ],
      payroll_status: ["draft", "processed", "paid"],
    },
  },
} as const
