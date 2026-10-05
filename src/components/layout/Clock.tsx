import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";

// 분 단위로만 갱신 — 1초 틱으로 헤더 전체가 리렌더되지 않도록 TopNav에서 분리
const Clock = () => {
	const { isDark } = useTheme();
	const { i18n } = useTranslation();
	const isKo = i18n.language?.toLowerCase().startsWith("ko");
	const [currentTime, setCurrentTime] = useState<Date>(new Date());

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>;
		const schedule = () => {
			const now = new Date();
			const msToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
			timer = setTimeout(() => {
				setCurrentTime(new Date());
				schedule();
			}, msToNextMinute);
		};
		setCurrentTime(new Date());
		schedule();
		return () => clearTimeout(timer);
	}, []);

	const h = currentTime.getHours() % 12 || 12;
	const m = String(currentTime.getMinutes()).padStart(2, "0");
	const isPm = currentTime.getHours() >= 12;
	const ampm = isKo ? (isPm ? "오후" : "오전") : isPm ? "PM" : "AM";
	const dayStr = currentTime.toLocaleDateString(isKo ? "ko-KR" : "en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});

	return (
		<div className="hidden sm:flex items-baseline gap-1.5">
			<span
				className="text-[19px] font-light tabular-nums"
				style={{ letterSpacing: "-0.04em" }}
			>
				{h}:{m}
			</span>
			<span
				className={`text-[10px] font-medium ${
					isDark ? "text-morning-dark-muted" : "text-morning-light-muted"
				}`}
			>
				{ampm} · {dayStr}
			</span>
		</div>
	);
};

export default Clock;
