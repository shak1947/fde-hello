import { publishableKey } from "@/lib/ads/auth";
import { adsMode, devBypassEnabled } from "@/lib/ads/mode";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    portal: "sensationally-ot-amazon-ads",
    mode: adsMode(),
    auth: publishableKey() ? "clerk" : "missing",
    devBypass: devBypassEnabled(),
  });
}
