import { AdsApiError } from "@/lib/ads/amazon";
import { isActor, requireActor } from "@/lib/ads/http";
import { redactSecrets } from "@/lib/ads/redact";
import { loadSearchTerms } from "@/lib/ads/search-terms";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await requireActor(request);
  if (!isActor(actor)) return actor;
  try {
    return Response.json(await loadSearchTerms());
  } catch (error) {
    const message = redactSecrets(error instanceof AdsApiError ? error.message : "Search terms could not be loaded.");
    return Response.json({ error: message }, { status: 502 });
  }
}
