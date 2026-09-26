import { isActor, requireActor } from "@/lib/ads/http";
import { rejectProposal } from "@/lib/ads/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const actor = await requireActor(request);
  if (!isActor(actor)) return actor;
  const { id } = await context.params;
  const result = await rejectProposal(actor, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ proposal: result.proposal });
}
