import { isActor, requireActor } from "@/lib/ads/http";
import { workspace } from "@/lib/ads/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await requireActor(request);
  if (!isActor(actor)) return actor;
  try {
    return Response.json(await workspace(actor));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the ads workspace.";
    return Response.json({ error: message }, { status: 502 });
  }
}
