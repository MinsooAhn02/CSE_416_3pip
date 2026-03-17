import { useState, useEffect } from "react";
import { User, Moon, Sun, Search } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import QuickLinks from "./QuickLinks";

const TopNav = () => {
	const { isDark, inputCls } = useTheme();
	const setTheme = useSettingsStore((s) => s.setTheme);

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
		<header className="relative z-10 flex items-center justify-between px-6 pt-10 pb-14">
			{/* Left — Avatar */}
			<div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white/30">
				<User size={20} className="text-white" />
			</div>

			{/* Center — Clock + Search */}
			<div className="flex flex-col items-center gap-8">
				<h1 className="text-4xl font-light tracking-tighter drop-shadow-lg">
					{timeStr}
				</h1>
				<form onSubmit={handleSearch} className="w-full max-w-md relative group">
					<div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
						<Search
							className={`${isDark ? "text-white/40" : "text-gray-400"} group-focus-within:text-blue-400 transition-colors`}
							size={18}
						/>
					</div>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="검색하거나 AI에게 물어보세요..."
						className={`w-full h-11 backdrop-blur-xl rounded-full pl-10 pr-5 text-sm outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg border ${inputCls}`}
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
