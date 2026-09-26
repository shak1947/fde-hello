import { isActor, requireActor } from "@/lib/ads/http";
import { exportDataset } from "@/lib/ads/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await requireActor(request);
  if (!isActor(actor)) return actor;
  const dataset = new URL(request.url).searchParams.get("dataset") || "";
  const file = await exportDataset(dataset);
  if (!file) return Response.json({ error: "Choose campaigns, keywords, or audit." }, { status: 400 });
  return new Response(file.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
