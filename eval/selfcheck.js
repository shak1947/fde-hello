var L = require("./logic.js");
var fails = L.selfCheck();
if (fails.length) {
  console.error("FAIL\n" + fails.join("\n"));
  process.exit(1);
}
var mermaid = L.sampleMermaid();
var farm = L.sampleFarm();
var mermaidEcon = L.economics(mermaid);
var farmEcon = L.economics(farm);
console.log("ok");
console.log(JSON.stringify({
  mermaid: {
    cogs: mermaidEcon.cogs,
    fees: mermaidEcon.feeStack,
    contribution: mermaidEcon.contribution,
    net: mermaidEcon.reportedNet,
    gap: mermaidEcon.unexplainedGap,
    marginPct: mermaidEcon.marginPctUsed,
    score: L.scoreSummary(mermaid.criteria).hundredths,
    band: L.scoreSummary(mermaid.criteria).band.id,
    status: mermaidEcon.commercial.id
  },
  farm: {
    cogs: farmEcon.cogs,
    fees: farmEcon.feeStack,
    contribution: farmEcon.contribution,
    net: farmEcon.reportedNet,
    gap: farmEcon.unexplainedGap,
    marginPct: farmEcon.marginPctUsed,
    score: L.scoreSummary(farm.criteria).hundredths,
    band: L.scoreSummary(farm.criteria).band.id,
    status: farmEcon.commercial.id,
    listPrice: farm.overview.listPrice
  }
}, null, 2));
