var L = require("./logic.js");
var fails = L.selfCheck();
if (fails.length) {
  console.error("FAIL\n" + fails.join("\n"));
  process.exit(1);
}
var calm = L.sampleCalmBin();
var econ = L.economics(calm);
var comp = L.competitionInsight(calm.competitors);
var moat = L.moatSummary(calm.moat);
console.log("ok");
console.log(JSON.stringify({
  landed: econ.landed,
  contribution: econ.contribution,
  contributionPct: econ.contributionPct,
  afterAds: econ.afterAds,
  afterAdsPct: econ.afterAdsPct,
  breakeven: econ.breakevenUnits,
  breakevenAds: econ.breakevenAfterAds,
  annual: econ.annualAfterAds,
  annualContrib: econ.annualContribution,
  cash: econ.cashTied,
  share: comp.share,
  tracked: comp.trackedRevenue,
  units: comp.trackedUnits,
  moat: L.formatHundredths(moat.hundredths),
  planRev: econ.monthlyRevenuePlan
}, null, 2));
