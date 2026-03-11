import { useRef } from "react";
import {
	X,
	Moon,
	Sun,
	Image,
	User,
	LogOut,
	GripVertical,
	RefreshCw,
	Sparkles,
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import { useAuthStore } from "../../store/useAuthStore";
import { WIDGET_LIST } from "../../constants";
import { mockSmartWidgets } from "../../mock/data";
import { save } from "../../utils/storage";
import Toggle from "../common/Toggle";

const SettingsModal = () => {
	const { isDark, muted, inputCls } = useTheme();
	const {
		showSettings,
		settingsTab,
		theme,
		bgImage,
		setShowSettings,
		setSettingsTab,
		setTheme,
		setBgImage,
		removeBg,
	} = useSettingsStore();
	const {
		vis,
		smartKeywords,
		newKeyword,
		toggleVis,
		resetLayout,
		setNewKeyword,
		addSmartWidget,
		removeSmartWidget,
	} = useWidgetStore();
	const { logout, setShowOnboarding, setObStep } = useAuthStore();
	const setOnboarded = (v) => {
		useAuthStore.setState({ onboarded: v });
		save("mb_onboarded", v);
	};

	const bgRef = useRef(null);

	if (!showSettings) return null;

	const handleBgUpload = (e) => {
		const f = e.target.files?.[0];
		if (!f) return;
		const r = new FileReader();
		r.onloadend = () => setBgImage(r.result);
		r.readAsDataURL(f);
	};

	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div
				className={`w-full max-w-2xl rounded-3xl shadow-2xl border overflow-hidden ${
					isDark
						? "bg-slate-800 border-white/20 text-white"
						: "bg-white border-gray-200 text-slate-800"
				}`}
			>
				<div
					className={`flex items-center justify-between p-6 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}
				>
					<h2 className="text-lg font-bold">⚙️ 설정</h2>
					<button onClick={() => setShowSettings(false)}>
						<X size={20} className="opacity-60 hover:opacity-100" />
					</button>
				</div>
				<div className="flex min-h-[400px]">
					<div
						className={`w-44 border-r p-4 space-y-1 ${isDark ? "border-white/10" : "border-gray-200"}`}
					>
						{[
							{ id: "widgets", label: "위젯 관리" },
							{ id: "smart", label: "스마트 위젯" },
							{ id: "layout", label: "레이아웃" },
							{ id: "theme", label: "테마" },
							{ id: "profile", label: "프로필" },
						].map((tab) => (
							<button
								key={tab.id}
								onClick={() => setSettingsTab(tab.id)}
								className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
									settingsTab === tab.id
										? isDark
											? "bg-blue-600/30 text-blue-300"
											: "bg-blue-50 text-blue-600"
										: isDark
											? "hover:bg-white/10"
											: "hover:bg-gray-100"
								}`}
							>
								{tab.label}
							</button>
						))}
					</div>
					<div className="flex-1 p-6 overflow-y-auto max-h-[500px]">
						{settingsTab === "widgets" && (
							<div className="space-y-3">
								<p className={`text-xs mb-2 ${muted}`}>
									기본 위젯을 켜고 끌 수 있습니다. 꺼진 위젯은 여기서 다시
									활성화하세요.
								</p>
								{WIDGET_LIST.map((w) => (
									<div
										key={w.id}
										className={`flex items-center justify-between p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
									>
										<div className="flex items-center gap-2">
											<span className="text-sm">{w.label}</span>
											{w.category === "smart" && (
												<span
													className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-700"}`}
												>
													Smart
												</span>
											)}
											{!vis[w.id] && (
												<span
													className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-red-500/20 text-red-300" : "bg-red-100 text-red-600"}`}
												>
													꺼짐
												</span>
											)}
										</div>
										<Toggle on={vis[w.id]} onToggle={() => toggleVis(w.id)} />
									</div>
								))}
							</div>
						)}
						{settingsTab === "smart" && (
							<div className="space-y-4">
								<p className={`text-xs mb-2 ${muted}`}>
									AI 키워드 위젯을 관리합니다. 키워드를 추가하면 AI가 관련
									데이터를 자동 수집합니다.
								</p>
								{smartKeywords.length === 0 ? (
									<p className={`text-sm text-center py-6 ${muted}`}>
										등록된 스마트 위젯이 없습니다
									</p>
								) : (
									smartKeywords.map((kw) => (
										<div
											key={kw}
											className={`flex items-center justify-between p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
										>
											<div className="flex items-center gap-2">
												<Sparkles
													size={14}
													className={
														isDark ? "text-yellow-300" : "text-yellow-600"
													}
												/>
												<span className="text-sm font-medium">
													{mockSmartWidgets[kw]?.emoji || "🔍"} {kw}
												</span>
												{mockSmartWidgets[kw] ? (
													<span
														className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-green-500/20 text-green-300" : "bg-green-100 text-green-700"}`}
													>
														데이터 있음
													</span>
												) : (
													<span
														className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-orange-500/20 text-orange-300" : "bg-orange-100 text-orange-700"}`}
													>
														대기 중
													</span>
												)}
											</div>
											<button
												onClick={() => removeSmartWidget(kw)}
												className="text-red-400 hover:text-red-300 text-xs"
											>
												삭제
											</button>
										</div>
									))
								)}
								<div className="flex gap-2 mt-3">
									<input
										type="text"
										value={newKeyword}
										onChange={(e) => setNewKeyword(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && addSmartWidget()}
										placeholder="키워드 입력..."
										className={`flex-grow rounded-xl px-4 py-2.5 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
									/>
									<button
										onClick={addSmartWidget}
										className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold"
									>
										추가
									</button>
								</div>
							</div>
						)}
						{settingsTab === "layout" && (
							<div className="space-y-4">
								<p className={`text-xs mb-2 ${muted}`}>
									위젯을 드래그하여 원하는 위치로 이동할 수 있습니다. 위젯
									모서리를 잡아 크기를 조절할 수 있습니다.
								</p>
								<div
									className={`p-4 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
								>
									<div className="flex items-center gap-3 mb-3">
										<GripVertical
											size={18}
											className={isDark ? "text-blue-300" : "text-blue-600"}
										/>
										<div>
											<p className="text-sm font-medium">드래그 & 드롭</p>
											<p className={`text-xs ${muted}`}>
												위젯 왼쪽 상단의 ⠿ 핸들을 잡고 드래그하세요
											</p>
										</div>
									</div>
									<div className="flex items-center gap-3">
										<RefreshCw
											size={18}
											className={isDark ? "text-blue-300" : "text-blue-600"}
										/>
										<div>
											<p className="text-sm font-medium">크기 조절</p>
											<p className={`text-xs ${muted}`}>
												위젯 오른쪽 하단 모서리를 잡아 크기를 변경하세요
											</p>
										</div>
									</div>
								</div>
								<button
									onClick={resetLayout}
									className={`w-full p-3 rounded-xl text-sm font-medium transition-colors ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"}`}
								>
									🔄 레이아웃 초기화
								</button>
							</div>
						)}
						{settingsTab === "theme" && (
							<div className="space-y-6">
								<div>
									<p className="text-sm font-medium mb-3">테마 모드</p>
									<div className="flex gap-3">
										{[
											{
												id: "dark",
												label: "다크",
												icon: <Moon size={18} />,
											},
											{
												id: "light",
												label: "라이트",
												icon: <Sun size={18} />,
											},
										].map((t) => (
											<button
												key={t.id}
												onClick={() => setTheme(t.id)}
												className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
													theme === t.id
														? "border-blue-500 bg-blue-500/20"
														: isDark
															? "border-white/10 bg-white/5 hover:bg-white/10"
															: "border-gray-200 bg-gray-50 hover:bg-gray-100"
												}`}
											>
												{t.icon}
												<span className="text-sm font-medium">{t.label}</span>
											</button>
										))}
									</div>
								</div>
								<div>
									<p className="text-sm font-medium mb-3">배경 이미지</p>
									<input
										type="file"
										ref={bgRef}
										accept="image/*"
										onChange={handleBgUpload}
										className="hidden"
									/>
									<div className="flex gap-3">
										<button
											onClick={() => bgRef.current?.click()}
											className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-colors ${
												isDark
													? "border-white/20 bg-white/5 hover:bg-white/10"
													: "border-gray-200 bg-gray-50 hover:bg-gray-100"
											}`}
										>
											<Image size={16} /> 이미지 업로드
										</button>
										{bgImage && (
											<button
												onClick={removeBg}
												className="px-4 py-2 rounded-xl text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30"
											>
												배경 제거
											</button>
										)}
									</div>
									{bgImage && (
										<div className="mt-3 rounded-xl overflow-hidden h-24">
											<img
												src={bgImage}
												alt="bg preview"
												className="w-full h-full object-cover"
											/>
										</div>
									)}
								</div>
							</div>
						)}
						{settingsTab === "profile" && (
							<div className="space-y-6">
								<div className="flex items-center gap-4">
									<div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center border-2 border-blue-400">
										<User size={28} className="text-white" />
									</div>
									<div>
										<p className="font-bold">MorningBrief.AI User</p>
										<p className={`text-xs ${muted}`}>user@google.com (demo)</p>
									</div>
								</div>
								<button
									onClick={() => {
										setOnboarded(false);
										setShowOnboarding(true);
										setObStep(0);
										setShowSettings(false);
									}}
									className={`w-full p-3 rounded-xl text-sm text-left ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"}`}
								>
									🔄 온보딩 다시하기
								</button>
								<button
									onClick={() => {
										logout();
										setShowSettings(false);
									}}
									className="w-full p-3 rounded-xl text-sm text-left bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-2"
								>
									<LogOut size={16} /> 로그아웃
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default SettingsModal;
