import { User, Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { mockBookmarks } from "../../mock/data";

const TopNav = () => {
	const { isDark, muted } = useTheme();
	const setTheme = useSettingsStore((s) => s.setTheme);

	return (
		<div className="relative z-10 w-full p-6 flex justify-between items-start">
			<div className="flex flex-col gap-4">
				<div className="flex items-center gap-3 mb-2">
					<div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white/30">
						<User size={20} className="text-white" />
					</div>
					<div>
						<p className={`text-xs ${muted}`}>안녕하세요,</p>
						<p className="font-bold text-sm tracking-tight">
							MorningBrief.AI User
						</p>
					</div>
				</div>
				<div className="flex gap-2">
					{mockBookmarks.map((link, i) => (
						<a
							key={i}
							href={link.url}
							target="_blank"
							rel="noreferrer"
							title={link.name}
							className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border group ${
								isDark
									? "bg-white/5 hover:bg-white/20 border-white/10"
									: "bg-white/50 hover:bg-white/80 border-gray-200"
							}`}
						>
							<span className="font-bold text-xs group-hover:scale-110 transition-transform inline-block">
								{link.icon}
							</span>
						</a>
					))}
				</div>
			</div>
			<button
				onClick={() => setTheme(isDark ? "light" : "dark")}
				className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
					isDark
						? "bg-white/5 hover:bg-white/15 border-white/10"
						: "bg-white/50 hover:bg-white/80 border-gray-200"
				}`}
			>
				{isDark ? <Moon size={18} /> : <Sun size={18} />}
			</button>
		</div>
	);
};

export default TopNav;
