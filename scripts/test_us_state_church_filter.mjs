import { churchSelectOptionsForBranch } from "../src/admin/satelliteSites.js";
import { hydrateBranchLabelsFromCatalog } from "../src/admin/branchRegions.js";

hydrateBranchLabelsFromCatalog({
  countries: [{ id: 12, branch_country_code: "US", name: "United States" }],
  states: [
    { country_id: 12, branch_state_code: "AL", name: "Alabama" },
    { country_id: 12, branch_state_code: "MD", name: "Maryland" },
    { country_id: 12, branch_state_code: "TX", name: "Texas" },
    { country_id: 12, branch_state_code: "PA", name: "Pennsylvania" },
  ],
});

const globalCatalog = [
  { branch_country: "NG", branch_state: "LA", name: "LAGOS CHURCH" },
  { branch_country: "US", branch_state: "MD", name: "COLLEGE PARK, MARY LAND" },
  { branch_country: "US", branch_state: "MD", name: "WINDSOR MILL, MARY LAND" },
  { branch_country: "US", branch_state: "TX", name: "RICHMOND, TEXAS" },
  { branch_country: "US", branch_state: "PA", name: "ERIE, PENNSYLVANIA" },
  { branch_country: "US", branch_state: "AL", name: "BIRMINGHAM, ALABAMA" },
];

function assert(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    process.exitCode = 1;
  } else {
    console.log(`ok ${label}`);
  }
}

assert("US + AL shows 1 church", churchSelectOptionsForBranch(globalCatalog, "US", "AL").length, 1);
assert("US + MD shows 2 churches", churchSelectOptionsForBranch(globalCatalog, "US", "MD").length, 2);
assert("US + TX shows 1 church", churchSelectOptionsForBranch(globalCatalog, "US", "TX").length, 1);
assert("US + PA shows 1 church", churchSelectOptionsForBranch(globalCatalog, "US", "PA").length, 1);
assert("US + AL never shows 5", churchSelectOptionsForBranch(globalCatalog, "US", "AL").length === 5, false);

const alabamaOnly = churchSelectOptionsForBranch(globalCatalog, "US", "AL").map((o) => o.label);
if (!alabamaOnly[0]?.includes("BIRMINGHAM")) {
  console.error("FAIL Alabama church name:", alabamaOnly);
  process.exitCode = 1;
} else {
  console.log("ok Alabama church is Birmingham");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("All US state church filter checks passed.");
