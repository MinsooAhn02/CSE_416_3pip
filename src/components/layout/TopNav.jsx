import { useState, useEffect } from "react";
import { User, Moon, Sun, Search, BookOpen, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useAuthStore } from "../../store/useAuthStore";
import QuickLinks from "./QuickLinks";
import DiaryListModal from "../modals/DiaryListModal";

/* ── 아날로그 시계 컴포넌트 ── */
const AnalogClock = ({ time, isDark }) => {
	const hours = time.getHours() % 12;
	const minutes = time.getMinutes();
	const seconds = time.getSeconds();

	const hourDeg = (hours + minutes / 60) * 30; // 360/12 = 30
	const minuteDeg = (minutes + seconds / 60) * 6; // 360/60 = 6
	const secondDeg = seconds * 6;

	const clockBg = isDark ? "bg-[#1a1a1a]" : "bg-white/80";
	const borderColor = isDark ? "border-white/20" : "border-gray-300";
	const handColor = isDark ? "bg-white" : "bg-gray-800";

	return (
		<div
			className={`relative w-24 h-24 rounded-full ${clockBg} border-2 ${borderColor} shadow-lg`}
		>
			{/* Hour markers */}
			{[...Array(12)].map((_, i) => (
				<div
					key={i}
					className={`absolute w-1 h-2 ${handColor} rounded-full`}
					style={{
						top: "8px",
						left: "50%",
						transform: `translateX(-50%) rotate(${i * 30}deg)`,
						transformOrigin: "50% 40px",
					}}
				/>
			))}
			{/* Hour hand */}
			<div
				className={`absolute w-1.5 h-6 ${handColor} rounded-full`}
				style={{
					bottom: "50%",
					left: "50%",
					transform: `translateX(-50%) rotate(${hourDeg}deg)`,
					transformOrigin: "50% 100%",
				}}
			/>
			{/* Minute hand */}
			<div
				className={`absolute w-1 h-8 ${handColor} rounded-full`}
				style={{
					bottom: "50%",
					left: "50%",
					transform: `translateX(-50%) rotate(${minuteDeg}deg)`,
					transformOrigin: "50% 100%",
				}}
			/>
			{/* Second hand */}
			<div
				className="absolute w-0.5 h-9 bg-red-500 rounded-full"
				style={{
					bottom: "50%",
					left: "50%",
					transform: `translateX(-50%) rotate(${secondDeg}deg)`,
					transformOrigin: "50% 100%",
				}}
			/>
			{/* Center dot */}
			<div
				className={`absolute w-2 h-2 ${handColor} rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`}
			/>
		</div>
	);
};

const TopNav = () => {
	const { isDark, inputCls, navBtnCls } = useTheme();
	const { t, i18n } = useTranslation();
	const setTheme = useSettingsStore((s) => s.setTheme);
	const clockStyle = useSettingsStore((s) => s.clockStyle);
	const is12Hour = useSettingsStore((s) => s.is12Hour);
	const user = useAuthStore((s) => s.user);

	const [currentTime, setCurrentTime] = useState(new Date());
	const [searchQuery, setSearchQuery] = useState("");
	const [showDiaryList, setShowDiaryList] = useState(false);
	const isKo = i18n.language?.toLowerCase().startsWith("ko");

	// Language toggle handler
	const handleLanguageToggle = () => {
		const newLang = i18n.language === "ko" ? "en" : "ko";
		i18n.changeLanguage(newLang);
		localStorage.setItem("language", newLang);
	};

	useEffect(() => {
		const t = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(t);
	}, []);

	// 12시간 형식으로 "2:00 PM" 형태 포맷
	const hours12 = currentTime.getHours() % 12 || 12;
	const minutes = String(currentTime.getMinutes()).padStart(2, "0");
	const ampm = currentTime.getHours() >= 12 ? "PM" : "AM";
	const timeStr = `${hours12}:${minutes} ${ampm}`;

	const detailedTimeStr = currentTime.toLocaleString(
		isKo ? "ko-KR" : "en-US",
		{
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: !isKo,
		},
	);

	const handleSearch = (e) => {
		e.preventDefault();
		if (searchQuery.trim())
			window.open(
				`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
				"_blank",
				"noopener,noreferrer",
			);
	};

	return (
		<header className="relative z-10 flex items-center justify-between px-10 pt-6 pb-6">
			{/* Left — Avatar with user profile */}
			<div className="flex items-center gap-3">
				{user?.avatarUrl ? (
					<img
						src={user.avatarUrl}
						alt={user.displayName || (isKo ? "프로필" : "Profile")}
						className="w-10 h-10 rounded-full border-2 border-white/30 object-cover cursor-pointer hover:border-blue-400 transition-colors"
					/>
				) : (
					<div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white/30">
						<User size={20} className="text-white" />
					</div>
				)}
				{user?.displayName && (
					<div className="hidden sm:block">
						<p className="text-sm font-medium truncate max-w-[120px]">
							{user.displayName}
						</p>
						{user.email && (
							<p
								className={`text-xs truncate max-w-[120px] ${isDark ? "opacity-50" : "text-gray-500"}`}
							>
								{user.email}
							</p>
						)}
					</div>
				)}
			</div>

			{/* Center — Clock + Search */}
			<div className="flex flex-col items-center gap-7 flex-1">
				{/* 환경설정에서 선택한 시계 스타일 반영 */}
				{clockStyle === "analog" ? (
					<AnalogClock time={currentTime} isDark={isDark} />
				) : clockStyle === "dateInfo" ? (
					<h1 className="text-2xl font-light tracking-tight drop-shadow-lg whitespace-nowrap">
						{detailedTimeStr}
					</h1>
				) : (
					<h1 className="text-7xl font-light tracking-tighter drop-shadow-lg">
						{timeStr}
					</h1>
				)}
				<form
					onSubmit={handleSearch}
					className="w-[42%] max-w-3xl relative group"
				>
					<div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
						<Search
							className={`${isDark ? "text-white/50" : "text-gray-500"} group-focus-within:text-blue-400 transition-colors`}
							size={18}
						/>
					</div>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={t("nav.search_placeholder")}
						className={`w-full h-11 backdrop-blur-xl rounded-full pl-14 pr-10 text-sm outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg border ${inputCls}`}
					/>
				</form>
			</div>

			{/* Right — QuickLinks + Diary List + Theme toggle */}
			<div className="flex items-center gap-2">
				<QuickLinks />
				<button
					onClick={() => setShowDiaryList(true)}
					className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${navBtnCls}`}
					title={t("nav.diary_list")}
				>
					<BookOpen size={18} className="text-blue-500" />
				</button>

				{/* Language Toggle Button */}
				<button
					onClick={handleLanguageToggle}
					className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all relative ${navBtnCls}`}
					title={t("nav.language")}
				>
					<Languages size={18} className="text-green-500" />
					<span className="absolute -bottom-0.5 -right-0.5 text-[10px] font-bold bg-green-500 text-white px-1 rounded">
						{i18n.language?.toUpperCase()}
					</span>
				</button>

				<button
					onClick={() => setTheme(isDark ? "light" : "dark")}
					className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${navBtnCls}`}
					title={t("nav.theme_toggle")}
				>
					{isDark ? <Moon size={18} /> : <Sun size={18} />}
				</button>
			</div>

			{/* Diary List Modal */}
			{showDiaryList && (
				<DiaryListModal onClose={() => setShowDiaryList(false)} />
			)}
		</header>
	);
};

export default TopNav;
