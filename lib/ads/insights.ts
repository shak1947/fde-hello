export function sellerboardSummary(): string {
  return [
    "Sellerboard analysis (sample figures for reading profit next to ads, not a live Sellerboard pull).",
    "SOT Sensory Chews: sales $110.50, ad spend $64.20, estimated profit $28.10, margin about 25%.",
    "SOT Brand Defense: sales $540.10, ad spend $128.40, estimated profit $210.00, margin about 39%.",
    "This view is read-only. Sellerboard settings cannot be changed here, and no password or API key is included.",
  ].join(" ");
}

export function helium10Summary(): string {
  return [
    "Helium 10 analysis (sample keyword research, not a live Helium 10 pull).",
    "“sensory chew”: search volume about 18,000, competing products about 420. Useful as an exact keyword on SOT Brand Defense.",
    "“chew necklace sensory”: search volume about 6,400, competing products about 260. The paused SOT Sensory Chews campaign already targets it.",
    "This view is read-only. Helium 10 projects cannot be changed here, and no password or API key is included.",
  ].join(" ");
}

export function researchReply(text: string): string | null {
  const sellerboard = /\bsellerboard\b/i.test(text);
  const helium = /\b(helium\s*10|\bh10\b|cerebro|magnet)\b/i.test(text);
  if (!sellerboard && !helium) return null;
  const parts: string[] = [];
  if (sellerboard) parts.push(sellerboardSummary());
  if (helium) parts.push(helium10Summary());
  return parts.join(" ");
}
