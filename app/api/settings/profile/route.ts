import { requireApiUser } from "@/lib/auth/session";
import { updateUserProfile } from "@/lib/db/users";
import { profileSettingsSchema } from "@/lib/validation/settings";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const { name, locale } = profileSettingsSchema.parse(body);
    const updated = await updateUserProfile(user.id, { name, locale });
    return apiSuccess({ name: updated.name, locale: updated.locale });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
