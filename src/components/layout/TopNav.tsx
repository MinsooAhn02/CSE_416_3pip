import { useState, useEffect } from "react";
import { User, Moon, Sun, Search, BookOpen, Languages, PanelRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useAuthStore } from "../../store/useAuthStore";
import QuickLinks from "./QuickLinks";
import DiaryListModal from "../modals/DiaryListModal";

const TopNav = () => {
	const { isDark, inputCls, navBtnCls } = useTheme();
	const { t, i18n } = useTranslation();
	const setTheme = useSettingsStore((s) => s.setTheme);
	const user = useAuthStore((s) => s.user);

	const [currentTime, setCurrentTime] = useState<Date>(new Date());
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [showDiaryList, setShowDiaryList] = useState<boolean>(false);
	const [panelOpen, setPanelOpen] = useState<boolean>(true);
	const isKo = i18n.language?.toLowerCase().startsWith("ko");

	// Language toggle
	const handleLanguageToggle = () => {
		const newLang = i18n.language === "ko" ? "en" : "ko";
		i18n.changeLanguage(newLang);
		localStorage.setItem("language", newLang);
	};

	// Clock tick
	useEffect(() => {
		const id = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(id);
	}, []);

	// Sync panelOpen with DashboardLayout via custom event
	useEffect(() => {
		const handler = (e: CustomEvent<{ open?: boolean }>) => setPanelOpen(e.detail?.open ?? true);
		window.addEventListener("widget-panel-state", handler as EventListener);
		return () => window.removeEventListener("widget-panel-state", handler as EventListener);
	}, []);

	const handlePanelToggle = () => {
		const next = !panelOpen;
		setPanelOpen(next);
		window.dispatchEvent(
			new CustomEvent("toggle-widget-panel", { detail: { open: next } }),
		);
	};

	// Compact time format
	const h = currentTime.getHours() % 12 || 12;
	const m = String(currentTime.getMinutes()).padStart(2, "0");
	const ampm = currentTime.getHours() >= 12 ? "PM" : "AM";
	const dayStr = currentTime.toLocaleDateString(isKo ? "ko-KR" : "en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (searchQuery.trim())
			window.open(
				`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
				"_blank",
				"noopener,noreferrer",
			);
	};

	return (
		<header
			className={`sticky top-0 z-20 flex items-center h-14 px-10 border-b transition-colors duration-200 ${
				isDark
					? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
					: "bg-morning-light-card border-morning-light-hover text-morning-light-text"
			}`}
		>
			{/* ── Left: Avatar + Name + Divider + Clock ── */}
			<div className="flex items-center gap-3 shrink-0">
				{user?.avatarUrl ? (
					<img
						src={user.avatarUrl}
						alt={user.displayName || (isKo ? "프로필" : "Profile")}
						className="w-8 h-8 rounded-full object-cover cursor-pointer border-2 border-transparent hover:border-morning-light-accent transition-colors"
					/>
				) : (
					<div
						className={`w-8 h-8 rounded-full flex items-center justify-center ${
							isDark ? "bg-morning-dark-accent" : "bg-morning-light-accent"
						}`}
					>
						<User size={15} className="text-white" />
					</div>
				)}

				{user?.displayName && (
					<span className="hidden sm:block text-sm font-semibold truncate max-w-[108px]">
						{user.displayName}
					</span>
				)}

				<div
					className={`hidden sm:block w-px h-[18px] ${
						isDark ? "bg-morning-dark-hover" : "bg-morning-light-hover"
					}`}
				/>

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
			</div>

			{/* ── Center: Search ── */}
			<form
				onSubmit={handleSearch}
				className="flex-1 max-w-[440px] mx-8 relative group"
			>
				<div className="absolute inset-y-0 left-3 flex items-center pointer-events-none z-10">
					<Search
						size={14}
						className={`transition-colors ${
							isDark
								? "text-morning-dark-muted group-focus-within:text-morning-dark-accent"
								: "text-morning-light-muted group-focus-within:text-morning-light-accent"
						}`}
					/>
				</div>
				<input
					type="text"
					value={searchQuery}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
					placeholder={t("nav.search_placeholder")}
					className={`w-full h-9 rounded-[10px] pl-9 pr-4 text-sm outline-none transition-all border focus:ring-2 ${
						isDark
							? "focus:ring-morning-dark-accent/20"
							: "focus:ring-morning-light-accent/20"
					} ${inputCls}`}
				/>
			</form>

			{/* ── Right: Actions ── */}
			<div className="flex items-center gap-3 ml-auto shrink-0">
				<QuickLinks />

				<button
					onClick={() => setShowDiaryList(true)}
					className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${navBtnCls}`}
					title={t("nav.diary_list")}
				>
					<BookOpen
						size={14}
						className={
							isDark ? "text-morning-dark-accent" : "text-morning-light-accent"
						}
					/>
				</button>

				<button
					onClick={handleLanguageToggle}
					className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all relative ${navBtnCls}`}
					title={t("nav.language")}
				>
					<Languages size={14} className="text-green-500" />
					<span className="absolute -bottom-0.5 -right-0.5 text-[9px] font-bold bg-green-500 text-white px-0.5 rounded leading-none py-0.5">
						{i18n.language?.slice(0, 2).toUpperCase()}
					</span>
				</button>

				<button
					onClick={() => setTheme(isDark ? "light" : "dark")}
					className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${navBtnCls}`}
					title={t("nav.theme_toggle")}
				>
					{isDark ? <Moon size={14} /> : <Sun size={14} />}
				</button>

				{/* Widget panel toggle */}
				<button
					onClick={handlePanelToggle}
					className={`w-8 h-8 rounded-[9px] flex items-center justify-center border transition-all ${
						panelOpen
							? isDark
								? "bg-morning-dark-accent border-morning-dark-accent text-white"
								: "bg-morning-light-accent border-morning-light-accent text-white"
							: navBtnCls
					}`}
					title={panelOpen ? "Hide widgets" : "Show widgets"}
				>
					<PanelRight size={14} />
				</button>
			</div>

			{showDiaryList && (
				<DiaryListModal onClose={() => setShowDiaryList(false)} />
			)}
		</header>
	);
};

export default TopNav;
