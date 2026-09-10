/**
 * Peak-hour banner — browser half.
 *
 * Two seats over one clock:
 *  - `conversation.input.dock` (the context strip above the composer): the
 *    warning card, rendered only while DeepSeek bills peak rates.
 *  - `conversation.composer.dock` (the composer footer row shared with the
 *    shipped StatsPills): a muted pill marking the next peak window, rendered
 *    only while the rate is off-peak.
 *
 * The stats seat cannot live inside StatsPills' own `root` element — that div
 * belongs to `@deepseek-ai/dsh-client-ui-chat` and exposes no slot — so it
 * copies that row's geometry and reads as one more pill in the footer.
 *
 * Schedule (official pricing page, https://api-docs.deepseek.com/quick_start/pricing):
 * off-peak costs half of peak; peak hours are 01:00-04:00 and 06:00-10:00 UTC,
 * Monday through Friday. Every other hour is off-peak. Windows are evaluated in
 * UTC because the provider bills in UTC — local clock time is only displayed.
 *
 * Bundle contract: a classic script registering one lazy factory with the
 * shell's module loader. `react` is a platform seed word, so no `dsh.client.external`
 * entry is needed; the factory body runs at materialization, never at script load.
 */
window.__ModuleLoader__.load({
	id: "@mateobarbato/dsh-client-ui-peak-hour",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");

		//#region peak schedule
		const MINUTE_MS = 60000;
		/** Peak windows as [startMinute, endMinute) offsets from UTC midnight. */
		const PEAK_WINDOWS_UTC = [
			[1 * 60, 4 * 60],
			[6 * 60, 10 * 60]
		];
		/** Days that can hold a peak window: Monday(1) through Friday(5) in UTC. */
		function isWeekdayUtc(day) {
			return day >= 1 && day <= 5;
		}
		/** Minutes elapsed since UTC midnight. */
		function utcMinuteOfDay(ms) {
			const date = new Date(ms);
			return date.getUTCHours() * 60 + date.getUTCMinutes();
		}
		/** Whether `ms` falls inside a peak window. */
		function isPeak(ms) {
			if (!isWeekdayUtc(new Date(ms).getUTCDay())) return false;
			const minute = utcMinuteOfDay(ms);
			return PEAK_WINDOWS_UTC.some(([start, end]) => minute >= start && minute < end);
		}
		/**
		 * The next instant the peak flag flips, with the flag it flips to.
		 * Candidate edges are the window boundaries of the next eight UTC days;
		 * one that does not actually change the flag (a weekend boundary) is skipped.
		 * @returns `{ at, peak }`, or `undefined` when no edge exists in range.
		 */
		function nextTransition(ms) {
			const date = new Date(ms);
			const year = date.getUTCFullYear();
			const month = date.getUTCMonth();
			const day = date.getUTCDate();
			for (let offset = 0; offset <= 8; offset += 1) {
				for (const [start, end] of PEAK_WINDOWS_UTC) {
					for (const boundary of [start, end]) {
						const at = Date.UTC(year, month, day + offset) + boundary * MINUTE_MS;
						if (at <= ms) continue;
						const peak = isPeak(at);
						if (peak === isPeak(at - MINUTE_MS)) continue;
						return { at, peak };
					}
				}
			}
			return undefined;
		}
		/** Human distance such as `1 h 12 min`. */
		function formatDistance(target, now) {
			const total = Math.max(0, Math.round((target - now) / MINUTE_MS));
			const hours = Math.floor(total / 60);
			const minutes = total % 60;
			if (hours === 0) return `${minutes} min`;
			if (minutes === 0) return `${hours} h`;
			return `${hours} h ${minutes} min`;
		}
		/** Zero-padded local wall clock for one instant. */
		function formatLocalClock(ms) {
			const date = new Date(ms);
			const pad = (value) => String(value).padStart(2, "0");
			return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}
		/** Zero-padded UTC wall clock for one instant. */
		function formatUtcClock(ms) {
			const date = new Date(ms);
			const pad = (value) => String(value).padStart(2, "0");
			return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
		}
		//#endregion

		//#region presentation
		/** Refresh cadence; the schedule changes on minute boundaries only. */
		const TICK_MS = 5000;
		/** Schedule rule shared as the tooltip of both seats. */
		const RULE_TITLE = "Tarifas DeepSeek: hora pico 01:00-04:00 y 06:00-10:00 UTC, lunes a viernes";
		/**
		 * Card geometry, copied from the shipped GoalBar dock so the peak card lines
		 * up with the composer card and the message action row instead of spanning
		 * the whole conversation pane. The composer stack is a flex column that
		 * already supplies the gap, and the resolved max width
		 * (`--dsh-composer-card-max-width` minus four dock insets) equals
		 * `--dsh-chat-content-width`, the chat column the action row lives in.
		 */
		const CARD_STYLE = {
			boxSizing: "border-box",
			width: "calc(100% - 2 * var(--dsh-composer-side-clearance, 16px) - 4 * var(--dsh-composer-dock-inset, 8px))",
			maxWidth: "calc(var(--dsh-composer-card-max-width, 100%) - 4 * var(--dsh-composer-dock-inset, 8px))",
			margin: "0 auto",
			display: "flex",
			alignItems: "center",
			gap: "10px",
			height: "36px",
			padding: "4px 12px",
			borderRadius: "12px",
			fontSize: "13px",
			flex: "none",
			background: "var(--dsw-alias-state-warn-tertiary, rgba(245, 158, 11, 0.16))",
			border: ".5px solid var(--dsw-alias-state-warn-primary, #f59e0b)"
		};
		const CARD_GLYPH_STYLE = { flex: "none", display: "inline-flex", color: "var(--dsw-alias-state-warn-label, #b45309)" };
		const CARD_LABEL_STYLE = {
			flex: "none",
			color: "var(--dsw-alias-label-primary, inherit)",
			fontWeight: 500,
			whiteSpace: "nowrap"
		};
		const CARD_DETAIL_STYLE = {
			flex: "1",
			minWidth: 0,
			color: "var(--dsw-alias-label-primary-dimmed, inherit)",
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis"
		};
		/**
		 * Stats-row geometry, copied from the shipped StatsPills module so the
		 * off-peak line reads as one more muted pill in the composer footer rather
		 * than a second banner.
		 */
		const STATS_ROW_STYLE = {
			boxSizing: "border-box",
			width: "100%",
			maxWidth: "var(--dsh-chat-content-width, 100%)",
			margin: "0 auto",
			padding: "4px calc(var(--dsh-composer-side-clearance, 16px) + 16px) 0px",
			display: "flex",
			justifyContent: "center",
			gap: "12px",
			fontSize: "var(--dsh-content-font-size-secondary, 13px)",
			lineHeight: "calc(20px + var(--dsh-content-font-delta-secondary, 0px))",
			flex: "none"
		};
		const STATS_PILL_STYLE = {
			boxSizing: "border-box",
			maxWidth: "100%",
			display: "inline-flex",
			alignItems: "center",
			gap: "6px",
			padding: "1px 8px",
			borderRadius: "24px",
			color: "var(--dsw-alias-label-tertiary, inherit)",
			whiteSpace: "nowrap",
			fontVariantNumeric: "tabular-nums"
		};
		/**
		 * One clock per seat, so the flag flips on its own at the next UTC boundary
		 * without a reload.
		 * @returns the current flag plus the timing text both seats display.
		 */
		function usePeakState() {
			const [now, setNow] = react.useState(() => Date.now());
			react.useEffect(() => {
				const timer = setInterval(() => setNow(Date.now()), TICK_MS);
				return () => clearInterval(timer);
			}, []);
			const peak = isPeak(now);
			const transition = nextTransition(now);
			return {
				peak,
				distance: transition === undefined ? "" : formatDistance(transition.at, now),
				local: transition === undefined ? "" : formatLocalClock(transition.at),
				when: transition === undefined ? "" : `${formatUtcClock(transition.at)} UTC / ${formatLocalClock(transition.at)} local`
			};
		}
		/**
		 * Peak seat: the warning card above the composer. Renders nothing while the
		 * rate is off-peak, when the stats seat carries the schedule instead.
		 */
		function PeakHourDock() {
			const { peak, distance, when } = usePeakState();
			if (!peak) return null;
			return react.createElement(
				"div",
				{
					style: CARD_STYLE,
					role: "status",
					"data-dsh-peak-hour": "peak",
					title: RULE_TITLE
				},
				react.createElement("span", { style: CARD_GLYPH_STYLE, "aria-hidden": "true" }, "⚡"),
				react.createElement("span", { style: CARD_LABEL_STYLE }, "HORA PICO · tarifas al doble"),
				react.createElement("span", { style: CARD_DETAIL_STYLE }, `Termina en ${distance} · ${when}`)
			);
		}
		/**
		 * Off-peak seat: the muted pill in the composer footer that marks the next
		 * peak window. Renders nothing during peak, when the card is the signal.
		 */
		function PeakHourStats() {
			const { peak, distance, local } = usePeakState();
			if (peak) return null;
			const text = distance === "" ? "Fuera de hora pico" : `Fuera de hora pico · próxima ${local} local (en ${distance})`;
			return react.createElement(
				"div",
				{ style: STATS_ROW_STYLE },
				react.createElement(
					"span",
					{
						style: STATS_PILL_STYLE,
						role: "status",
						"data-dsh-peak-hour": "off-peak",
						title: RULE_TITLE
					},
					react.createElement("span", { "aria-hidden": "true" }, "✓"),
					text
				)
			);
		}
		//#endregion

		//#region plugin face
		/**
		 * Register both seats: the peak card on the composer context dock and the
		 * off-peak pill in the composer footer row.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.slots.inject(
				"conversation.input.dock",
				() =>
					ctx.slots.register(
						{
							name: "conversation.input.dock",
							id: "peak-hour",
							order: 25
						},
						PeakHourDock
					)
			);
			ctx.slots.inject(
				"conversation.composer.dock",
				() =>
					ctx.slots.register(
						{
							name: "conversation.composer.dock",
							id: "peak-hour",
							order: 10
						},
						PeakHourStats
					)
			);
		}
		/** Services this plugin needs; it reads no session state. */
		const inject = ["slots"];
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		exports.PeakHourDock = PeakHourDock;
		exports.PeakHourStats = PeakHourStats;
		exports.isPeak = isPeak;
		exports.nextTransition = nextTransition;
		return module.exports;
	}
});
