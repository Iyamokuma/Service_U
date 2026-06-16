import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type NotificationSenderMeta = {
  sender_name: string;
  sender_role?: string;
  sender_kind?: "admin" | "system" | "applicant" | "announcement";
  sender_id?: number;
};

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

export function notificationSenderMetadata(sender: NotificationSenderMeta): Record<string, unknown> {
  return {
    sender_name: norm(sender.sender_name),
    ...(sender.sender_role ? { sender_role: norm(sender.sender_role) } : {}),
    ...(sender.sender_kind ? { sender_kind: sender.sender_kind } : {}),
    ...(sender.sender_id != null && Number.isFinite(Number(sender.sender_id))
      ? { sender_id: Number(sender.sender_id) }
      : {}),
  };
}

export async function insertAdminNotification(
  supabase: SupabaseClient,
  row: {
    admin_id: number;
    type: string;
    title: string;
    body: string;
    entity_type?: string;
    entity_id?: string;
    metadata?: Record<string, unknown>;
    sender?: NotificationSenderMeta;
  },
): Promise<void> {
  const metadata = {
    ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
    ...(row.sender ? notificationSenderMetadata(row.sender) : {}),
  };
  await supabase.from("admin_notifications").insert({
    admin_id: row.admin_id,
    type: norm(row.type) || "update",
    title: norm(row.title) || "Notification",
    body: norm(row.body),
    entity_type: norm(row.entity_type),
    entity_id: norm(row.entity_id),
    metadata,
  });
}

export function systemNotificationSender(label: string): NotificationSenderMeta {
  return { sender_name: norm(label) || "Salvation Ministries", sender_kind: "system" };
}

export function adminNotificationSender(
  admin: { id?: unknown; full_name?: unknown; role?: unknown },
): NotificationSenderMeta {
  return {
    sender_name: norm(admin.full_name) || "Admin",
    sender_role: norm(admin.role) || undefined,
    sender_kind: "admin",
    sender_id: Number(admin.id) || undefined,
  };
}

export function applicantNotificationSender(name: string): NotificationSenderMeta {
  return {
    sender_name: norm(name) || "Applicant",
    sender_kind: "applicant",
  };
}
