import type { AdsMode } from "./types";

export type AmazonEnv = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  profileId: string;
  region: string;
  apiBase: string;
  tokenUrl: string;
};

export function amazonEnv(): AmazonEnv {
  const region = (process.env.AMAZON_ADS_REGION || "NA").trim().toUpperCase();
  const apiBase =
    process.env.AMAZON_ADS_API_BASE?.trim() ||
    (region === "EU"
      ? "https://advertising-api-eu.amazon.com"
      : region === "FE"
        ? "https://advertising-api-fe.amazon.com"
        : "https://advertising-api.amazon.com");
  return {
    clientId: process.env.AMAZON_ADS_CLIENT_ID?.trim() || "",
    clientSecret: process.env.AMAZON_ADS_CLIENT_SECRET?.trim() || "",
    refreshToken: process.env.AMAZON_ADS_REFRESH_TOKEN?.trim() || "",
    profileId: process.env.AMAZON_ADS_PROFILE_ID?.trim() || "",
    region,
    apiBase: apiBase.replace(/\/$/, ""),
    tokenUrl:
      process.env.AMAZON_ADS_TOKEN_URL?.trim() ||
      "https://api.amazon.com/auth/o2/token",
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
