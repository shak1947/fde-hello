import { isActor, requireActor } from "@/lib/ads/http";
import { recordFeedback } from "@/lib/ads/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireActor(request);
  if (!isActor(actor)) return actor;
  const body = await request.json().catch(() => null);
  const result = await recordFeedback(actor, body);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ check: result.check });
}
