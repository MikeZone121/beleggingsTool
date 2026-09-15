import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { addToWatchlist, listWatchlist } from "@/lib/db/watchlist";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

const addSchema = z.object({
  securityId: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
});

export async function GET() {
  try {
    const user = await requireApiUser();
    const items = await listWatchlist(user.id);
    return apiSuccess(items);
  } catch (error) {
    return apiErrorFromException(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const { securityId, notes } = addSchema.parse(body);
    const item = await addToWatchlist(user.id, securityId, notes ?? null);
    return apiSuccess(item, { status: 201 });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
