import { useMemo } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";

const to24 = (hour12: string, minute: string, period: string): string => {
	let h = Number(hour12);
	if (period === "AM") {
		if (h === 12) h = 0;
	} else if (h !== 12) {
		h += 12;
	}
	return `${String(h).padStart(2, "0")}:${minute}`;
};

interface ParsedTime {
	hours: number;
	minutes: string;
}

const parse24 = (value: string): ParsedTime | null => {
	if (!value || !value.includes(":")) return null;
	const [hours, minutes] = value.split(":");
	return {
		hours: Number(hours),
		minutes: String(minutes || "00").padStart(2, "0"),
	};
};

const buildAllowedTimes = (minTime = ""): string[] =>
	Array.from({ length: 24 * 12 }, (_, index) => {
		const hours = String(Math.floor(index / 12)).padStart(2, "0");
		const minutes = String((index % 12) * 5).padStart(2, "0");
		return `${hours}:${minutes}`;
	}).filter((time) => !minTime || time >= minTime);

const selectCls =
	"appearance-none text-center rounded-lg border px-2 py-2 text-sm outline-none transition-all focus:ring-2 cursor-pointer";

interface TimeInputProps {
	value: string;
	onChange: (value: string) => void;
	required?: boolean;
	showFormatToggle?: boolean;
	force12Hour?: boolean;
	minTime?: string;
}

const TimeInput = ({
	value,
	onChange,
	required = false,
	showFormatToggle = true,
	force12Hour = false,
	minTime = "",
}: TimeInputProps) => {
	const { isDark, inputCls } = useTheme();
	const is12Hour = useSettingsStore((state) => state.is12Hour);
	const setIs12Hour = useSettingsStore((state) => state.setIs12Hour);
	const effectiveIs12Hour = force12Hour || is12Hour;
	const allowedTimes = useMemo(() => buildAllowedTimes(minTime), [minTime]);
	const normalizedValue = !value || !minTime || value >= minTime ? value : "";
	const parsed = parse24(normalizedValue);
	const hasValue = !!parsed;

	const availablePeriods = useMemo(() => {
		if (!effectiveIs12Hour) return [];
		const periods: string[] = [];
		if (allowedTimes.some((time) => Number(time.slice(0, 2)) < 12)) {
			periods.push("AM");
		}
		if (allowedTimes.some((time) => Number(time.slice(0, 2)) >= 12)) {
			periods.push("PM");
		}
		return periods;
	}, [allowedTimes, effectiveIs12Hour]);

	const currentPeriod = useMemo(() => {
		if (!effectiveIs12Hour) return "";
		if (parsed) return parsed.hours < 12 ? "AM" : "PM";
		return availablePeriods[0] || "AM";
	}, [availablePeriods, effectiveIs12Hour, parsed]);

	const displayHour = useMemo(() => {
		if (!parsed) return "";
		if (!effectiveIs12Hour) return String(parsed.hours).padStart(2, "0");
		return String(parsed.hours % 12 || 12);
	}, [effectiveIs12Hour, parsed]);

	const displayMinute = parsed?.minutes || "";

	const hourOptions = useMemo(() => {
		const unique: string[] = [];
		allowedTimes.forEach((time) => {
			const hours24 = Number(time.slice(0, 2));
			if (effectiveIs12Hour) {
				const period = hours24 < 12 ? "AM" : "PM";
				if (period !== currentPeriod) return;
				const hour12 = String(hours24 % 12 || 12);
				if (!unique.includes(hour12)) unique.push(hour12);
				return;
			}

			const hour24 = String(hours24).padStart(2, "0");
			if (!unique.includes(hour24)) unique.push(hour24);
		});
		return unique;
	}, [allowedTimes, currentPeriod, effectiveIs12Hour]);

	const activeHour = displayHour || hourOptions[0] || "";

	const minuteOptions = useMemo(() => {
		const unique: string[] = [];
		allowedTimes.forEach((time) => {
			const hours24 = Number(time.slice(0, 2));
			const minute = time.slice(3, 5);
			if (effectiveIs12Hour) {
				const period = hours24 < 12 ? "AM" : "PM";
				const hour12 = String(hours24 % 12 || 12);
				if (period !== currentPeriod || hour12 !== activeHour) return;
			} else if (String(hours24).padStart(2, "0") !== activeHour) {
				return;
			}
			if (!unique.includes(minute)) unique.push(minute);
		});
		return unique;
	}, [activeHour, allowedTimes, currentPeriod, effectiveIs12Hour]);

	const commitTime = (nextHour: string, nextMinute: string, nextPeriod = currentPeriod): void => {
		if (!nextHour) return;
		const minute = nextMinute || minuteOptions[0] || "00";
		if (effectiveIs12Hour) {
			onChange(to24(nextHour, minute, nextPeriod || "AM"));
			return;
		}
		onChange(`${nextHour}:${minute}`);
	};

	const handleHourChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
		const nextHour = event.target.value;
		const validMinutes = allowedTimes
			.filter((time) => {
				const hours24 = Number(time.slice(0, 2));
				if (effectiveIs12Hour) {
					const period = hours24 < 12 ? "AM" : "PM";
					const hour12 = String(hours24 % 12 || 12);
					return period === currentPeriod && hour12 === nextHour;
				}
				return time.slice(0, 2) === nextHour;
			})
			.map((time) => time.slice(3, 5));
		const nextMinute = validMinutes.includes(displayMinute)
			? displayMinute
			: validMinutes[0];
		commitTime(nextHour, nextMinute, currentPeriod);
	};

	const handleMinuteChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
		const nextMinute = event.target.value;
		const nextHour = displayHour || hourOptions[0];
		commitTime(nextHour, nextMinute, currentPeriod);
	};

	const handlePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
		const nextPeriod = event.target.value;
		const nextHourOptions: string[] = [];
		allowedTimes.forEach((time) => {
			const hours24 = Number(time.slice(0, 2));
			const period = hours24 < 12 ? "AM" : "PM";
			const hour12 = String(hours24 % 12 || 12);
			if (period === nextPeriod && !nextHourOptions.includes(hour12)) {
				nextHourOptions.push(hour12);
			}
		});
		const nextHour = nextHourOptions.includes(displayHour)
			? displayHour
			: nextHourOptions[0];
		const nextMinuteOptions = allowedTimes
			.filter((time) => {
				const hours24 = Number(time.slice(0, 2));
				const period = hours24 < 12 ? "AM" : "PM";
				const hour12 = String(hours24 % 12 || 12);
				return period === nextPeriod && hour12 === nextHour;
			})
			.map((time) => time.slice(3, 5));
		const nextMinute = nextMinuteOptions.includes(displayMinute)
			? displayMinute
			: nextMinuteOptions[0];
		commitTime(nextHour, nextMinute, nextPeriod);
	};

	const toggleFormat = (): void => {
		setIs12Hour(!is12Hour);
	};

	const selectClassName = `${selectCls} ${inputCls} ${
		isDark ? "focus:ring-blue-500/30" : "focus:ring-blue-400/30"
	}`;

	return (
		<div className="flex items-center gap-1.5">
			<select
				value={displayHour}
				onChange={handleHourChange}
				required={required}
				className={`${selectClassName} w-14`}
			>
				{!hasValue && (
					<option value="" disabled>
						{effectiveIs12Hour ? "hh" : "HH"}
					</option>
				)}
				{hourOptions.map((hour) => (
					<option key={hour} value={hour}>
						{hour}
					</option>
				))}
			</select>

			<span className="font-bold text-sm opacity-60">:</span>

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
				{minuteOptions.map((minute) => (
					<option key={minute} value={minute}>
						{minute}
					</option>
				))}
			</select>

			{effectiveIs12Hour && (
				<select
					value={currentPeriod}
					onChange={handlePeriodChange}
					className={`${selectClassName} w-16`}
				>
					{availablePeriods.map((period) => (
						<option key={period} value={period}>
							{period}
						</option>
					))}
				</select>
			)}

			{showFormatToggle && !force12Hour && (
				<button
					type="button"
					onClick={toggleFormat}
					title={`${is12Hour ? "24-hour" : "12-hour"} format`}
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
