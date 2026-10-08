"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { setUserRole, AdminActionError } from "@/lib/admin/adminService";

export async function updateUserRole(formData: FormData) {
  const actingUser = await requireAdmin();
  const targetUserId = String(formData.get("userId"));
  const role = formData.get("role");

  if (role !== "USER" && role !== "ADMIN") return;

  try {
    await setUserRole(targetUserId, role, actingUser.id);
  } catch (error) {
    if (error instanceof AdminActionError) return;
    throw error;
  }

  revalidatePath("/admin");
}
