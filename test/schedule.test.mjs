/**
 * Schedule test for the peak-hour banner.
 *
 * Loads the real browser bundle with a stubbed module loader and asserts the
 * peak/off-peak flag and the next transition at hand-picked UTC edges.
 *
 * Run: node test/schedule.test.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "lib", "client.js"), "utf8");

let factory;
globalThis.window = {
	__ModuleLoader__: {
		load(registration) {
			factory = registration.factory;
		}
	}
};
// eslint-disable-next-line no-eval -- the bundle is a classic script by contract
eval(source);
assert.equal(typeof factory, "function", "bundle must register a factory");
const bundle = factory((specifier) => {
	if (specifier === "react") return {};
	throw new Error(`unexpected require("${specifier}")`);
});
const { isPeak, nextTransition } = bundle;

const cases = [
	// [instant, expected peak, expected next transition instant, expected flag after it]
	["2026-09-10T23:07:00Z", false, "2026-09-11T01:00:00Z", true],
	["2026-09-11T00:59:00Z", false, "2026-09-11T01:00:00Z", true],
	["2026-09-11T01:00:00Z", true, "2026-09-11T04:00:00Z", false],
	["2026-09-11T03:59:00Z", true, "2026-09-11T04:00:00Z", false],
	["2026-09-11T04:00:00Z", false, "2026-09-11T06:00:00Z", true],
	["2026-09-11T05:59:00Z", false, "2026-09-11T06:00:00Z", true],
	["2026-09-11T09:59:00Z", true, "2026-09-11T10:00:00Z", false],
	["2026-09-11T10:00:00Z", false, "2026-09-14T01:00:00Z", true], // weekend gap
	["2026-09-12T02:00:00Z", false, "2026-09-14T01:00:00Z", true], // Saturday
	["2026-09-13T08:00:00Z", false, "2026-09-14T01:00:00Z", true], // Sunday
	["2026-09-14T00:30:00Z", false, "2026-09-14T01:00:00Z", true] // Monday
];

for (const [instant, expectedPeak, expectedNext, expectedFlag] of cases) {
	const at = Date.parse(instant);
	const actual = isPeak(at);
	assert.equal(actual, expectedPeak, `isPeak(${instant}) should be ${String(expectedPeak)}`);
	const transition = nextTransition(at);
	assert.notEqual(transition, undefined, `nextTransition(${instant}) must exist`);
	assert.equal(transition.at, Date.parse(expectedNext), `nextTransition(${instant}) instant`);
	assert.equal(transition.peak, expectedFlag, `nextTransition(${instant}) flag`);
}

// The whole schedule must round-trip: flagging every minute for 9 days must
// produce transitions exactly where the model says they are.
const start = Date.parse("2026-09-10T00:00:00Z");
let transitions = 0;
for (let offset = 0; offset < 9 * 24 * 60; offset += 1) {
	const at = start + offset * 60000;
	if (isPeak(at) !== isPeak(at + 60000)) transitions += 1;
}
// Seven weekdays (Sep 10-11 and Sep 14-18) x two windows x two edges.
assert.equal(transitions, 28, "9 UTC days (Thu-Fri + weekend + Mon-Fri) hold 28 window edges");

console.log(`ok — ${cases.length} edge cases and ${transitions} scanned transitions`);
