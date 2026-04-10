import { useMemo } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";

/**
 * TimeInput — styled hour/minute selects with 12hr/24hr toggle.
 *
 * Props:
 *   value     — "HH:MM" string (24-hr internal format) or ""
 *   onChange  — called with "HH:MM" string (24-hr) or ""
 *   required? — marks the selects required
 *   showFormatToggle? — shows 12h/24h toggle button (default: true)
 *   placeholder? — shown when value is empty (default: "--:--")
 */

const MINUTES = Array.from({ length: 12 }, (_, i) =>
	String(i * 5).padStart(2, "0"),
);

const to24 = (hour12, minute, period) => {
	let h = Number(hour12);
	if (period === "AM") {
		if (h === 12) h = 0;
	} else {
		if (h !== 12) h += 12;
	}
	return `${String(h).padStart(2, "0")}:${minute}`;
};

const parse24 = (val) => {
	if (!val || !val.includes(":")) return null;
	const [hStr, mStr] = val.split(":");
	return { h: Number(hStr), m: Number(mStr) };
};

const snapMinute = (m) => {
	const snapped = Math.round(m / 5) * 5;
	return String(Math.min(snapped, 55)).padStart(2, "0");
};

const selectCls =
	"appearance-none text-center rounded-lg border px-2 py-2 text-sm outline-none transition-all focus:ring-2 cursor-pointer";

const TimeInput = ({
	value,
	onChange,
	required = false,
	showFormatToggle = true,
}) => {
	const { isDark, inputCls } = useTheme();
	const is12Hour = useSettingsStore((s) => s.is12Hour);
	const setIs12Hour = useSettingsStore((s) => s.setIs12Hour);

	const parsed = parse24(value);
	const hasValue = !!parsed;

	/* Derive display values */
	const displayHour = useMemo(() => {
		if (!parsed) return "";
		if (!is12Hour) return String(parsed.h).padStart(2, "0");
		const h12 = parsed.h % 12 || 12;
		return String(h12);
	}, [parsed, is12Hour]);

	const displayMinute = useMemo(() => {
		if (!parsed) return "";
		return snapMinute(parsed.m);
	}, [parsed]);

	const displayPeriod = useMemo(() => {
		if (!parsed) return "AM";
		return parsed.h < 12 ? "AM" : "PM";
	}, [parsed]);

	/* Build hour options */
	const hourOptions = useMemo(() => {
		if (is12Hour) {
			return [12, ...Array.from({ length: 11 }, (_, i) => i + 1)].map((h) =>
				String(h),
			);
		}
		return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
	}, [is12Hour]);

	const handleHourChange = (e) => {
		const newHour = e.target.value;
		const minute = displayMinute || "00";
		if (is12Hour) {
			onChange(to24(newHour, minute, displayPeriod));
		} else {
			onChange(`${newHour}:${minute}`);
		}
	};

	const handleMinuteChange = (e) => {
		const newMin = e.target.value;
		if (!hasValue) {
			const fallbackHour = is12Hour ? "12" : "00";
			onChange(
				is12Hour
					? to24(fallbackHour, newMin, "AM")
					: `${fallbackHour}:${newMin}`,
			);
			return;
		}
		if (is12Hour) {
			onChange(to24(displayHour || "12", newMin, displayPeriod));
		} else {
			onChange(`${displayHour || "00"}:${newMin}`);
		}
	};

	const handlePeriodChange = (e) => {
		const newPeriod = e.target.value;
		const h = displayHour || "12";
		const m = displayMinute || "00";
		onChange(to24(h, m, newPeriod));
	};

	const toggleFormat = () => {
		setIs12Hour(!is12Hour);
		/* Keep the current time value — it's always stored as 24hr internally */
	};

	const selectClassName = `${selectCls} ${inputCls} ${isDark ? "focus:ring-blue-500/30" : "focus:ring-blue-400/30"}`;

	return (
		<div className="flex items-center gap-1.5">
			{/* Hour */}
			<select
				value={displayHour}
				onChange={handleHourChange}
				required={required}
				className={`${selectClassName} w-14`}
			>
				{!hasValue && (
					<option value="" disabled>
						{is12Hour ? "hh" : "HH"}
					</option>
				)}
				{hourOptions.map((h) => (
					<option key={h} value={h}>
						{h}
					</option>
				))}
			</select>

			<span className="font-bold text-sm opacity-60">:</span>

			{/* Minute */}
			<select
				value={displayMinute}
				onChange={handleMinuteChange}
				required={required}
				className={`${selectClassName} w-14`}
			>
				{!hasValue && (
					<option value="" disabled>
						mm
					</option>
				)}
				{MINUTES.map((m) => (
					<option key={m} value={m}>
						{m}
					</option>
				))}
			</select>

			{/* AM/PM */}
			{is12Hour && (
				<select
					value={displayPeriod}
					onChange={handlePeriodChange}
					className={`${selectClassName} w-16`}
				>
					<option value="AM">AM</option>
					<option value="PM">PM</option>
				</select>
			)}

			{/* Format toggle */}
			{showFormatToggle && (
				<button
					type="button"
					onClick={toggleFormat}
					title={`${is12Hour ? "24시간" : "12시간"} 형식으로 전환`}
					className={`text-[10px] font-medium px-2 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
						isDark
							? "border-morning-dark-hover text-morning-dark-muted hover:bg-morning-dark-hover"
							: "border-morning-light-hover/50 text-morning-light-muted hover:bg-morning-light-hover/40"
					}`}
				>
					{is12Hour ? "24h" : "12h"}
				</button>
			)}
		</div>
	);
};

export default TimeInput;
