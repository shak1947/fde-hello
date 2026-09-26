import { isActor, requireActor } from "@/lib/ads/http";
import { proposeAction } from "@/lib/ads/service";

export async function POST(request: Request) {
  const actor = await requireActor(request);
  if (!isActor(actor)) return actor;
  const body = await request.json().catch(() => null);
  const result = await proposeAction(actor, body);
  if (!result.ok) {
    return Response.json({ error: result.error, denied: Boolean(result.deny) }, { status: result.status });
  }
  return Response.json({ proposal: result.proposal });
}
