import { isActor, requireActor } from "@/lib/ads/http";
import { handleChat } from "@/lib/ads/service";

export const maxDuration = 60;

export async function POST(request: Request) {
  const actor = await requireActor(request);
  if (!isActor(actor)) return actor;
  const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
  if (!body || typeof body.message !== "string" || !body.message.trim()) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }
  const result = await handleChat(actor, body.message);
  return Response.json(result);
}
