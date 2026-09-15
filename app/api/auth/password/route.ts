import { compare, hash } from "bcryptjs";
import { requireApiUser } from "@/lib/auth/session";
import { getUserById, updateUserPassword } from "@/lib/db/users";
import { changePasswordSchema } from "@/lib/validation/auth";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function PATCH(request: Request) {
  try {
    const sessionUser = await requireApiUser();
    const body = await request.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    const user = await getUserById(sessionUser.id);
    if (!user?.passwordHash) {
      return apiError("REQUEST_ERROR", "This account has no password set", 400);
    }

    const valid = await compare(currentPassword, user.passwordHash);
    if (!valid) {
      return apiError("REQUEST_ERROR", "Current password is incorrect", 400);
    }

    const passwordHash = await hash(newPassword, 12);
    await updateUserPassword(user.id, passwordHash);

    return apiSuccess({ ok: true });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
