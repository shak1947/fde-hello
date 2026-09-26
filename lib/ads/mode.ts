import type { AdsMode } from "./types";

export type AmazonRegion = "NA" | "EU" | "FE";

export type AmazonEnv = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  profileId: string;
  region: AmazonRegion;
  apiBase: string;
  tokenUrl: string;
  authorizeUrl: string;
};

export function normalizeRegion(value: string | undefined): AmazonRegion {
  const raw = (value || "na").trim().toLowerCase();
  if (raw === "eu" || raw === "europe") return "EU";
  if (raw === "fe" || raw === "apac" || raw === "far_east" || raw === "far-east") return "FE";
  return "NA";
}

export function regionHosts(region: AmazonRegion): { apiBase: string; tokenUrl: string; authorizeUrl: string } {
  if (region === "EU") {
    return {
      apiBase: "https://advertising-api-eu.amazon.com",
      tokenUrl: "https://api.amazon.co.uk/auth/o2/token",
      authorizeUrl: "https://eu.account.amazon.com/ap/oa",
    };
  }
  if (region === "FE") {
    return {
      apiBase: "https://advertising-api-fe.amazon.com",
      tokenUrl: "https://api.amazon.co.jp/auth/o2/token",
      authorizeUrl: "https://apac.account.amazon.com/ap/oa",
    };
  }
  return {
    apiBase: "https://advertising-api.amazon.com",
    tokenUrl: "https://api.amazon.com/auth/o2/token",
    authorizeUrl: "https://www.amazon.com/ap/oa",
  };
}

export function amazonEnv(): AmazonEnv {
  const region = normalizeRegion(process.env.AMAZON_ADS_REGION);
  const hosts = regionHosts(region);
  const apiBase = process.env.AMAZON_ADS_API_BASE?.trim() || hosts.apiBase;
  return {
    clientId: process.env.AMAZON_ADS_CLIENT_ID?.trim() || "",
    clientSecret: process.env.AMAZON_ADS_CLIENT_SECRET?.trim() || "",
    refreshToken: process.env.AMAZON_ADS_REFRESH_TOKEN?.trim() || "",
    profileId: process.env.AMAZON_ADS_PROFILE_ID?.trim() || "",
    region,
    apiBase: apiBase.replace(/\/$/, ""),
    tokenUrl: process.env.AMAZON_ADS_TOKEN_URL?.trim() || hosts.tokenUrl,
    authorizeUrl: hosts.authorizeUrl,
  };
}

export function adsMode(): AdsMode {
  const env = amazonEnv();
  if (env.clientId && env.clientSecret && env.refreshToken && env.profileId) {
    return "live";
  }
  return "dry-run";
}

export function devBypassEnabled(): boolean {
  return process.env.ADS_PORTAL_DEV_BYPASS === "1" && !process.env.VERCEL;
}
