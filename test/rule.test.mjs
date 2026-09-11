/**
 * Rule conformance test for the peak-hour schedule.
 *
 * Both references are derived by PARSING the published rule text rather than by
 * restating the implementation, then compared against the bundle minute by
 * minute across a full year:
 *
 *  - the English page states the windows in UTC ("01:00 - 04:00 and
 *    06:00 - 10:00 UTC, Monday through Friday");
 *  - the Chinese page states the same rule on the Beijing clock
 *    ("北京时间周一至周五 9:00 - 12:00、14:00 - 18:00").
 *
 * The two wordings describe the same instants, and this test proves it instead
 * of assuming it: the Beijing reference is evaluated by shifting each instant
 * eight hours and reading the UTC fields as Beijing wall clock.
 *
 * Run: npm test
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const BUNDLE = new URL("../lib/client.js", import.meta.url);

/** English rule, quoted from https://api-docs.deepseek.com/quick_start/pricing */
const RULE_EN = "Off-peak rates are half of the peak rates. Peak hours are 01:00 - 04:00 and 06:00 - 10:00 UTC, Monday through Friday (all other hours are off-peak).";
/** Chinese rule, quoted from https://api-docs.deepseek.com/zh-cn/quick_start/pricing */
const RULE_ZH = "空闲时段价格为高峰时段价格的一半。高峰时段为北京时间周一至周五 9:00 - 12:00、14:00 - 18:00（其余为空闲时段）。";
/** Beijing is UTC+8, with no daylight saving. */
const BEIJING_OFFSET_MS = 8 * 3600000;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Parse `HH:MM - HH:MM` pairs into [startMinute, endMinute) offsets. */
function parseWindows(text) {
	return [...text.matchAll(/(\d{1,2}):(\d{2}) - (\d{1,2}):(\d{2})/g)].map((match) => ({
		start: Number(match[1]) * 60 + Number(match[2]),
		end: Number(match[3]) * 60 + Number(match[4]),
		label: `${match[1].padStart(2, "0")}:${match[2]}-${match[3].padStart(2, "0")}:${match[4]}`
	}));
}

const windowsUtc = parseWindows(RULE_EN);
const windowsBeijing = parseWindows(RULE_ZH);
assert.deepEqual(windowsUtc.map((w) => w.label), ["01:00-04:00", "06:00-10:00"], "English rule windows");
assert.deepEqual(windowsBeijing.map((w) => w.label), ["09:00-12:00", "14:00-18:00"], "Chinese rule windows");
assert.ok(RULE_EN.includes("Monday through Friday"), "English rule states the weekday range");
assert.ok(RULE_ZH.includes("周一至周五"), "Chinese rule states the weekday range");

/** Monday(1) through Friday(5). */
const WEEKDAY_SET = new Set([1, 2, 3, 4, 5]);
/** The rule is the same weekdays on either clock for these windows; asserted below. */
assert.deepEqual(
	[WEEKDAYS.indexOf("Monday"), WEEKDAYS.indexOf("Friday")],
	[1, 5],
	"the weekday range is Monday..Friday"
);

/** Reference on the UTC clock: the English wording, taken literally. */
function referenceUtc(ms) {
	const date = new Date(ms);
	if (!WEEKDAY_SET.has(date.getUTCDay())) return false;
	const minute = date.getUTCHours() * 60 + date.getUTCMinutes();
	return windowsUtc.some((w) => minute >= w.start && minute < w.end);
}

/** Reference on the Beijing clock: the Chinese wording, taken literally. */
function referenceBeijing(ms) {
	const wall = new Date(ms + BEIJING_OFFSET_MS);
	if (!WEEKDAY_SET.has(wall.getUTCDay())) return false;
	const minute = wall.getUTCHours() * 60 + wall.getUTCMinutes();
	return windowsBeijing.some((w) => minute >= w.start && minute < w.end);
}

// ---- load the real bundle with a stubbed module loader
let registration;
globalThis.window = { __ModuleLoader__: { load(entry) { registration = entry; } } };
// eslint-disable-next-line no-eval -- the bundle is a classic script by contract
eval(readFileSync(BUNDLE, "utf8"));
const bundle = registration.factory((specifier) => {
	if (specifier === "react") return {};
	throw new Error(`unexpected require("${specifier}")`);
});
const { isPeak, nextTransition } = bundle;

// ---- 1. every minute of 2026 must agree with both wordings
const start = Date.parse("2026-01-01T00:00:00Z");
const days = 365;
const minutes = days * 24 * 60;
let mismatches = 0;
let peakMinutes = 0;
let beijingDisagreements = 0;
for (let index = 0; index < minutes; index += 1) {
	const at = start + index * 60000;
	const utc = referenceUtc(at);
	const beijing = referenceBeijing(at);
	if (utc !== beijing) beijingDisagreements += 1;
	if (utc) peakMinutes += 1;
	if (isPeak(at) !== utc) {
		if (mismatches < 5) {
			console.log("  mismatch at", new Date(at).toISOString(), "bundle:", isPeak(at), "rule:", utc);
		}
		mismatches += 1;
	}
}
assert.equal(beijingDisagreements, 0, "the UTC and Beijing wordings must describe the same instants");
assert.equal(mismatches, 0, "isPeak must agree with the rule for every minute of 2026");

// The volume check is derived independently: one 7-hour block per weekday.
let weekdayCount = 0;
for (let day = 0; day < days; day += 1) {
	if (WEEKDAY_SET.has(new Date(start + day * 86400000).getUTCDay())) weekdayCount += 1;
}
const hoursPerWeekday = windowsUtc.reduce((sum, w) => sum + (w.end - w.start), 0) / 60;
assert.equal(hoursPerWeekday, 7, "the two windows cover seven hours");
assert.equal(peakMinutes, weekdayCount * hoursPerWeekday * 60, "peak volume must be weekdays times the window length");
console.log(`ok  isPeak vs both wordings: ${minutes} minutes, ${mismatches} mismatches, ${peakMinutes} peak minutes over ${weekdayCount} weekdays`);

// ---- 2. nextTransition must be exactly the next flip
let checked = 0;
let bad = 0;
const sampleEnd = Date.parse("2026-03-01T00:00:00Z");
for (let at = start; at < sampleEnd; at += 37 * 60000) {
	const transition = nextTransition(at);
	assert.notEqual(transition, undefined, `nextTransition(${new Date(at).toISOString()}) must resolve`);
	const current = isPeak(at);
	let expectedAt;
	for (let probe = at + 60000; probe <= at + 9 * 24 * 60 * 60000; probe += 60000) {
		if (isPeak(probe) !== current) { expectedAt = probe; break; }
	}
	if (expectedAt === undefined || transition.at > expectedAt || transition.at <= at || transition.peak === current) {
		if (bad < 5) {
			console.log("  nextTransition mismatch at", new Date(at).toISOString(), "->", new Date(transition.at).toISOString());
		}
		bad += 1;
	}
	checked += 1;
}
assert.equal(bad, 0, "nextTransition must point at the next flip");
console.log(`ok  nextTransition vs brute force: ${checked} samples, ${bad} mismatches`);

// ---- 3. named instants, so a reader can see the boundaries spelled out
const spots = [
	["2026-09-07T00:59:00Z", false, "Monday 00:59 — before the first window"],
	["2026-09-07T01:00:00Z", true, "Monday 01:00 — first window opens"],
	["2026-09-07T03:59:00Z", true, "Monday 03:59 — last peak minute"],
	["2026-09-07T04:00:00Z", false, "Monday 04:00 — first window closes"],
	["2026-09-07T05:59:00Z", false, "Monday 05:59 — gap between windows"],
	["2026-09-07T06:00:00Z", true, "Monday 06:00 — second window opens"],
	["2026-09-07T09:59:00Z", true, "Monday 09:59 — last peak minute"],
	["2026-09-07T10:00:00Z", false, "Monday 10:00 — second window closes"],
	["2026-09-11T02:00:00Z", true, "Friday 02:00 — weekday"],
	["2026-09-11T10:30:00Z", false, "Friday 10:30 — after the last window"],
	["2026-09-12T02:00:00Z", false, "Saturday 02:00 — weekend"],
	["2026-09-13T08:00:00Z", false, "Sunday 08:00 — weekend"],
	["2026-09-14T01:00:00Z", true, "Monday 01:00 — weekend is over"]
];
for (const [iso, expected, label] of spots) {
	assert.equal(isPeak(Date.parse(iso)), expected, `${label} (${iso})`);
}
console.log(`ok  spot checks: ${spots.length} instants`);

// ---- 4. the weekend gap: Friday 10:00 UTC to Monday 01:00 UTC is off-peak
const gapStart = Date.parse("2026-09-11T10:00:00Z");
const gapEnd = Date.parse("2026-09-14T01:00:00Z");
for (let at = gapStart; at < gapEnd; at += 60000) {
	assert.equal(isPeak(at), false, `weekend gap instant ${new Date(at).toISOString()} must be off-peak`);
}
assert.deepEqual(nextTransition(gapStart), { at: gapEnd, peak: true }, "the gap ends at Monday 01:00 UTC");
console.log("ok  weekend gap: Friday 10:00 UTC to Monday 01:00 UTC is off-peak");

console.log("\nok — schedule matches both published wordings");
