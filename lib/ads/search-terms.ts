import { gunzipSync } from "node:zlib";
import { amazonFetch } from "./amazon";
import { amazonEnv, adsMode, type AmazonEnv } from "./mode";
import { seedSearchTerms } from "./seed";
import type { SearchTerm } from "./types";

const REPORT_MEDIA = "application/vnd.createasyncreportrequest.v3+json";

export type SearchTermReport = {
  connected: boolean;
  label: "API not connected" | "Live Ads API";
  sample: boolean;
  status: "READY" | "PENDING" | "FAILED";
  note: string;
  rows: SearchTerm[];
};

type ReportJob = { reportId: string; createdAt: number; profileId: string };
const jobs = new Map<string, ReportJob>();

export function clearSearchTermJobs() {
  jobs.clear();
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function reportWindow(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 13);
  return { startDate: isoDay(start), endDate: isoDay(end) };
}

export async function loadSearchTerms(deps?: {
  env?: AmazonEnv;
  fetchImpl?: typeof fetch;
}): Promise<SearchTermReport> {
  if (adsMode() !== "live" && !deps?.env) {
    return {
      connected: false,
      label: "API not connected",
      sample: true,
      status: "READY",
      note: "API not connected. These search terms are labeled sample data, not a live Amazon report. Applying one as a keyword or negative still waits for confirmation.",
      rows: seedSearchTerms(),
    };
  }

  const env = deps?.env ?? amazonEnv();
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const existing = jobs.get(env.profileId);
  let reportId = existing && Date.now() - existing.createdAt < 30 * 60 * 1000 ? existing.reportId : "";
  if (!reportId) {
    const { startDate, endDate } = reportWindow();
    const created = await amazonFetch(
      {
        method: "POST",
        path: "/reporting/reports",
        media: REPORT_MEDIA,
        body: {
          name: `SOT SP search terms ${startDate}`,
          startDate,
          endDate,
          configuration: {
            adProduct: "SPONSORED_PRODUCTS",
            groupBy: ["searchTerm"],
            columns: [
              "searchTerm",
              "campaignId",
              "campaignName",
              "adGroupId",
              "adGroupName",
              "impressions",
              "clicks",
              "cost",
              "purchases7d",
              "sales7d",
            ],
            reportTypeId: "spSearchTerm",
            timeUnit: "SUMMARY",
            format: "GZIP_JSON",
          },
        },
      },
      { env, fetchImpl },
    );
    reportId = String((created as { reportId?: string }).reportId ?? "");
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(reportId)) {
      return {
        connected: true,
        label: "Live Ads API",
        sample: false,
        status: "FAILED",
        note: "Amazon did not return a search-term report id. No write was sent.",
        rows: [],
      };
    }
    jobs.set(env.profileId, { reportId, createdAt: Date.now(), profileId: env.profileId });
  }

  const statusPayload = (await amazonFetch(
    { method: "GET", path: `/reporting/reports/${reportId}`, media: REPORT_MEDIA },
    { env, fetchImpl },
  )) as { status?: string; url?: string; failureReason?: string };

  const status = String(statusPayload.status ?? "");
  if (status === "FAILED") {
    jobs.delete(env.profileId);
    return {
      connected: true,
      label: "Live Ads API",
      sample: false,
      status: "FAILED",
      note: "Amazon could not build the search-term report. No write was sent.",
      rows: [],
    };
  }
  if (status !== "COMPLETED" || typeof statusPayload.url !== "string") {
    return {
      connected: true,
      label: "Live Ads API",
      sample: false,
      status: "PENDING",
      note: "Amazon is building the Sponsored Products search-term report. Load again in a minute. No write has been sent.",
      rows: [],
    };
  }

  const download = await fetchImpl(statusPayload.url, { signal: AbortSignal.timeout(20_000) });
  if (!download.ok) {
    return {
      connected: true,
      label: "Live Ads API",
      sample: false,
      status: "FAILED",
      note: "The search-term file could not be read. No write was sent.",
      rows: [],
    };
  }
  const bytes = Buffer.from(await download.arrayBuffer());
  const jsonText = decodeReport(bytes);
  const parsed = JSON.parse(jsonText) as unknown;
  return {
    connected: true,
    label: "Live Ads API",
    sample: false,
    status: "READY",
    note: "Live Sponsored Products search terms. Applying a row as a keyword or negative still waits for confirmation.",
    rows: mapReportRows(parsed).slice(0, 100),
  };
}

function decodeReport(bytes: Buffer): string {
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return gunzipSync(bytes).toString("utf8");
  return bytes.toString("utf8");
}

function mapReportRows(payload: unknown): SearchTerm[] {
  const rows = Array.isArray(payload) ? payload : [];
  return rows
    .map((row) => {
      const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        searchTerm: String(record.searchTerm ?? ""),
        campaignId: String(record.campaignId ?? ""),
        campaignName: String(record.campaignName ?? ""),
        adGroupId: String(record.adGroupId ?? ""),
        impressions: Number(record.impressions ?? 0),
        clicks: Number(record.clicks ?? 0),
        cost: Number(record.cost ?? 0),
        sales: Number(record.sales7d ?? 0),
        orders: Number(record.purchases7d ?? 0),
        sample: false,
      } satisfies SearchTerm;
    })
    .filter((row) => row.searchTerm)
    .sort((a, b) => b.cost - a.cost);
}
