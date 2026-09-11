/**
 * Render test for the peak-hour bundle.
 *
 * Loads the real browser bundle with a stubbed module loader, runs the plugin's
 * `apply` against a stub slot service, and server-renders both seats with real
 * React under a frozen clock — one render per state.
 *
 * Run: npm test
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const React = require("react");
const ReactDOMServer = require("react-dom/server");

const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

let registration;
globalThis.window = {
	__ModuleLoader__: {
		load(entry) {
			registration = entry;
		}
	}
};
// eslint-disable-next-line no-eval -- the bundle is a classic script by contract
eval(source);
assert.equal(registration.id, "@mateobarbato/dsh-client-ui-peak-hour", "bundle id must match the package name");
assert.equal(typeof registration.factory, "function", "bundle must register a factory");

const bundle = registration.factory((specifier) => {
	if (specifier === "react") return React;
	throw new Error(`unexpected require("${specifier}")`);
});
assert.deepEqual(bundle.inject, ["slots"], "the plugin injects the slots service");

const seats = new Map();
bundle.apply({
	slots: {
		inject: (name, callback) => callback(),
		register: (options, component) => {
			seats.set(options.name, { options, component });
			return () => {};
		}
	}
});
assert.deepEqual(
	[...seats.keys()].sort(),
	["conversation.composer.dock", "conversation.input.dock"],
	"the plugin must occupy exactly the card seat and the stats seat"
);

const CARD = "conversation.input.dock";
const STATS = "conversation.composer.dock";
const realNow = Date.now;
const freeze = (iso) => {
	Date.now = () => Date.parse(iso);
};
const render = (seat) => ReactDOMServer.renderToStaticMarkup(React.createElement(seats.get(seat).component));

/** Local wall clock of one instant, computed here so the test is timezone-independent. */
function localClock(iso) {
	const date = new Date(Date.parse(iso));
	const pad = (value) => String(value).padStart(2, "0");
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

let checks = 0;
const check = (condition, label) => {
	checks += 1;
	assert.ok(condition, label);
};

// Off-peak: Thursday 23:07 UTC. The card stays away; the stats pill carries the
// next peak window (Friday 01:00 UTC).
freeze("2026-09-10T23:07:00Z");
const cardOff = render(CARD);
const statsOff = render(STATS);
check(cardOff === "", "the card must not render off-peak");
check(statsOff.includes('data-dsh-peak-hour="off-peak"'), "the stats seat must mark off-peak");
check(statsOff.includes("Fuera de hora pico"), "the stats seat must state the off-peak rate");
check(
	statsOff.includes(`próxima ${localClock("2026-09-11T01:00:00Z")} local`),
	"the stats seat must show the next peak in local time"
);
check(/en 1 h 5[0-9] min/.test(statsOff), "the stats seat must count down to the next peak");
check(statsOff.includes("max-width:var(--dsh-chat-content-width"), "the stats row must use the chat column width");

// Peak: Friday 02:55 UTC (inside the 01:00-04:00 window, 65 minutes left). The
// card renders above the composer; the stats seat steps aside.
freeze("2026-09-11T02:55:00Z");
const cardPeak = render(CARD);
const statsPeak = render(STATS);
check(statsPeak === "", "the stats seat must not render during peak");
check(cardPeak.includes('data-dsh-peak-hour="peak"'), "the card must mark peak");
check(cardPeak.includes("HORA PICO"), "the card must warn about peak rates");
check(cardPeak.includes("Termina en 1 h 5"), "the card must count down to the end of the window");
check(cardPeak.includes("04:00 UTC"), "the card must state the UTC end of the window");
check(
	cardPeak.includes("max-width:calc(var(--dsh-composer-card-max-width"),
	"the card must copy the composer dock width"
);
check(cardPeak.includes("--dsw-alias-state-warn-primary"), "the card must carry the warning border");

// Countdown rounding: the last minute before a boundary must read "1 min", never
// "0 min", on either seat.
freeze("2026-09-11T03:59:31Z"); // 29 seconds before the 04:00 UTC close
const cardLastMinute = render(CARD);
check(cardLastMinute.includes("Termina en 1 min"), "the card must not count down to 0 min");
check(!cardLastMinute.includes("0 min"), "the card must never show a zero countdown");

freeze("2026-09-11T00:59:31Z"); // 29 seconds before the 01:00 UTC open
const statsLastMinute = render(STATS);
check(statsLastMinute.includes("(en 1 min)"), "the pill must not count down to 0 min");
check(!statsLastMinute.includes("0 min"), "the pill must never show a zero countdown");

Date.now = realNow;
console.log(`ok — both seats rendered in both states (${checks} checks)`);
