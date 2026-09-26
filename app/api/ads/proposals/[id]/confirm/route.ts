import { isActor, requireActor } from "@/lib/ads/http";
import { confirmProposal } from "@/lib/ads/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const actor = await requireActor(request);
  if (!isActor(actor)) return actor;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const result = await confirmProposal(actor, id, body);
  if (!result.ok) {
    const question = "question" in result ? result.question : undefined;
    return Response.json({ error: result.error, question }, { status: result.status });
  }
  return Response.json({ proposal: result.proposal });
}
