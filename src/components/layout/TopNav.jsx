import { useState, useEffect } from "react";
import { User, Moon, Sun, Search } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useAuthStore } from "../../store/useAuthStore";
import QuickLinks from "./QuickLinks";

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
			<div className={`absolute w-2 h-2 ${handColor} rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`} />
		</div>
	);
};

const TopNav = () => {
	const { isDark, inputCls } = useTheme();
	const setTheme = useSettingsStore((s) => s.setTheme);
	const clockStyle = useSettingsStore((s) => s.clockStyle);
	const user = useAuthStore((s) => s.user);

	const [currentTime, setCurrentTime] = useState(new Date());
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		const t = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(t);
	}, []);

	const timeStr = currentTime.toLocaleTimeString("ko-KR", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	// 날짜 상세 포맷: "2026년 03월 18일 07시 17분 21초"
	const detailedTimeStr = `${currentTime.getFullYear()}년 ${String(currentTime.getMonth() + 1).padStart(2, "0")}월 ${String(currentTime.getDate()).padStart(2, "0")}일 ${String(currentTime.getHours()).padStart(2, "0")}시 ${String(currentTime.getMinutes()).padStart(2, "0")}분 ${String(currentTime.getSeconds()).padStart(2, "0")}초`;

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
		<header className="relative z-10 flex items-center justify-between px-12 pt-10 pb-14">
			{/* Left — Avatar with user profile */}
			<div className="flex items-center gap-3">
				{user?.avatarUrl ? (
					<img
						src={user.avatarUrl}
						alt={user.displayName || "프로필"}
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
							<p className={`text-xs truncate max-w-[120px] ${isDark ? "opacity-50" : "text-gray-500"}`}>
								{user.email}
							</p>
						)}
					</div>
				)}
			</div>

			{/* Center — Clock + Search */}
			<div className="flex flex-col items-center gap-12">
				{/* 환경설정에서 선택한 시계 스타일 반영 */}
				{clockStyle === "analog" ? (
					<AnalogClock time={currentTime} isDark={isDark} />
				) : clockStyle === "dateInfo" ? (
					<h1 className="text-2xl font-light tracking-tight drop-shadow-lg whitespace-nowrap">
						{detailedTimeStr}
					</h1>
				) : (
					<h1 className="text-6xl font-light tracking-tighter drop-shadow-lg">
						{timeStr}
					</h1>
				)}
				<form onSubmit={handleSearch} className="w-full max-w-5xl relative group">
					<div className="absolute inset-y-0 left-8 flex items-center pointer-events-none">
						<Search
							className={`${isDark ? "text-white/40" : "text-gray-400"} group-focus-within:text-blue-400 transition-colors`}
							size={20}
						/>
					</div>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="검색하거나 AI에게 물어보세요..."
						className={`w-full h-14 backdrop-blur-xl rounded-full pl-16 pr-12 text-base outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg border ${inputCls}`}
					/>
				</form>
			</div>

			{/* Right — QuickLinks + Theme toggle */}
			<div className="flex items-center gap-2">
				<QuickLinks />
				<button
					onClick={() => setTheme(isDark ? "light" : "dark")}
					className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
						isDark
							? "bg-[#2a2a2a] hover:bg-[#353535] border-[#3a3a3a]"
							: "bg-white/50 hover:bg-white/80 border-gray-200"
					}`}
				>
					{isDark ? <Moon size={18} /> : <Sun size={18} />}
				</button>
			</div>
		</header>
	);
};

export default TopNav;
