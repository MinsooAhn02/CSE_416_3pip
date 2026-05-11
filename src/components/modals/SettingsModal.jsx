import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	X,
	User,
	LogOut,
	GripVertical,
	RefreshCw,
	Sparkles,
	ListOrdered,
	Heart,
	Plus,
	Lock,
	Trash2,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useTheme } from "../../hooks/useTheme";
import {
	PIN_LOCK_OPTIONS,
	useSettingsStore,
} from "../../store/useSettingsStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useDiaryStore } from "../../store/useDiaryStore";
import { WIDGET_LIST, DEFAULT_PRIORITY_ORDER } from "../../constants";
import {
	buildFixedInterests,
	getFixedInterestLabel,
} from "../../utils/interests";
import Toggle from "../common/Toggle";
import ConfirmDialog from "../common/ConfirmDialog";
import PINModal from "./PINModal";

const FONT_SIZE_OPTIONS = [
	{ key: "small" },
	{ key: "medium" },
	{ key: "large" },
];

// Logout button with confirm dialog and loading state
const LogoutButton = ({ logout, setShowSettings }) => {
	const { i18n } = useTranslation();
	const [showConfirm, setShowConfirm] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [error, setError] = useState(null);
	const isKo = i18n.language?.toLowerCase().startsWith("ko");
	const copy = isKo
		? {
				error: "로그아웃 실패. 다시 시도해주세요.",
				logout: "로그아웃",
				logoutLoading: "로그아웃 중...",
				confirmTitle: "로그아웃",
				confirmMessage: "정말 로그아웃 하시겠습니까?",
		  }
		: {
				error: "Logout failed. Please try again.",
				logout: "Log out",
				logoutLoading: "Signing out...",
				confirmTitle: "Log out",
				confirmMessage: "Are you sure you want to log out?",
		  };

	const handleConfirmedLogout = async () => {
		setShowConfirm(false);
		setIsLoggingOut(true);
		setError(null);
		try {
			await logout();
			setShowSettings(false);
		} catch (e) {
			console.error("Logout failed:", e);
			setError(copy.error);
			setIsLoggingOut(false);
		}
	};

	return (
		<div className="space-y-1">
			<button
				onClick={() => setShowConfirm(true)}
				disabled={isLoggingOut}
				className="w-full p-3 rounded-xl text-sm text-left bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{isLoggingOut ? (
					<RefreshCw size={16} className="animate-spin" />
				) : (
					<LogOut size={16} />
				)}
				{isLoggingOut ? copy.logoutLoading : copy.logout}
			</button>
			{error && <p className="text-xs text-red-400 px-1">{error}</p>}
			{showConfirm && (
				<ConfirmDialog
					title={copy.confirmTitle}
					message={copy.confirmMessage}
					confirmLabel={copy.logout}
					onConfirm={handleConfirmedLogout}
					onCancel={() => setShowConfirm(false)}
				/>
			)}
		</div>
	);
};

const SettingsModal = () => {
	const { i18n } = useTranslation();
	const { isDark, muted, inputCls } = useTheme();
	const {
		showSettings,
		settingsTab,
		priorityOrder,
		showFirstLoginBriefing,
		fixedInterestIds,
		keywordInterests,
		setShowSettings,
		setSettingsTab,
		pinLockMode,
		setPriorityOrder,
		setPinLockMode,
		diaryLanguage,
		setDiaryLanguage,
		setShowFirstLoginBriefing,
		addKeywordInterest,
		removeKeywordInterest,
		resetKeywordInterests,
	} = useSettingsStore();

	const [newInterestKeyword, setNewInterestKeyword] = useState("");
	const {
		vis,
		smartKeywords,
		smartWidgetData,
		newKeyword,
		globalFontSize,
		toggleVis,
		resetDndLayout,
		setNewKeyword,
		setGlobalFontSize,
		addSmartWidget,
		removeSmartWidget,
	} = useWidgetStore();
	const { logout, setShowOnboarding, setObStep } = useAuthStore();
	const pinSet = useDiaryStore((s) => s.pinSet);
	const applyPinLockMode = useDiaryStore((s) => s.applyPinLockMode);
	const setOnboarded = (v) => {
		useAuthStore.setState({ onboarded: v });
	};
	const isKo = i18n.language?.toLowerCase().startsWith("ko");
	const settingsCopy = useMemo(
		() =>
			isKo
				? {
						title: "⚙️ 설정",
						tabs: {
							widgets: "위젯 관리",
							smart: "스마트 위젯",
							priority: "데이터 우선순위",
							briefing: "AI 브리핑",
							interests: "관심사",
							diary: "Diary",
							profile: "프로필",
						},
						fontSizes: {
							small: "작게",
							medium: "기본",
							large: "크게",
						},
						widgetNames: {
							health: "건강 (Google Fit)",
							calendar: "캘린더 (Google)",
							briefing: "AI 브리핑",
							trends: "실시간 트렌드",
							stocks: "주식/환율",
							weather: "날씨",
							news: "뉴스",
							smart: "스마트 위젯",
						},
						widgets: {
							fontSize: "글자 크기",
							fontSizeDesc: "전체 위젯에 공통으로 적용됩니다.",
							intro:
								"기본 위젯을 켜고 끌 수 있습니다. 꺼진 위젯은 여기서 다시 활성화하세요.",
							off: "꺼짐",
						},
						smart: {
							intro:
								"스마트 위젯을 관리합니다. 키워드를 추가하면 AI가 관련 데이터를 자동 수집합니다.",
							badge: "Smart",
							off: "꺼짐",
							keywordWidgets: "AI 키워드 위젯",
							ready: "AI 준비됨",
							pending: "대기 중",
							deleteTitle: "스마트 위젯 삭제",
							deleteMessage: (kw) => `'${kw}' 위젯을 삭제하시겠습니까?`,
							delete: "삭제",
							placeholder: "키워드 입력...",
							add: "추가",
						},
						profile: {
							noLogin: "로그인 정보 없음",
							restartOnboarding: "🔄 온보딩 다시하기",
							profileAlt: "프로필",
						},
						priority: {
							title: "데이터 우선순위",
							desc:
								"드래그하여 순서를 변경하세요. 높은 순위의 데이터가 AI 브리핑에서 먼저 언급됩니다.",
							reset: "🔄 기본 순서로 초기화",
						},
						briefing: {
							title: "AI 브리핑 설정",
							desc: "AI 브리핑 관련 설정을 관리합니다.",
							firstVisit: "첫 접속 상세 브리핑",
							firstVisitDesc:
								"자정 이후 첫 탭 열람 시 상세 브리핑을 자동으로 표시합니다.",
							factualTitle: "Factual-Only 모드",
							factualDesc:
								"AI 브리핑과 다이어리는 사실 기반으로만 생성됩니다. 감정적 표현, 비교, 예측은 자동으로 제외됩니다.",
						},
						interests: {
							title: "관심 키워드",
							desc:
								"AI가 Q&A와 일기에서 자동 수집한 키워드입니다. 직접 추가하거나 삭제할 수 있습니다.",
							placeholder: "키워드 입력 후 Enter",
							fixedTitle: "Fixed interests",
							fixedBadge: "Fixed",
							fixedSource: "Onboarding",
							noDynamic:
								"No dynamic interests yet. Diary and Q&A activity will add more over time.",
							empty:
								"아직 수집된 관심 키워드가 없습니다.\nQ&A에 답변하거나 일기를 작성하면 다음 날 자동으로 추출됩니다.",
							resetTitle: "관심사 초기화",
							resetMessage: "모든 관심 키워드와 누적 점수를 초기화하시겠습니까?",
							resetButton: "관심사 전체 초기화",
						},
						selected: "선택됨",
				  }
				: {
						title: "⚙️ Settings",
						tabs: {
							widgets: "Widget Management",
							smart: "Smart Widgets",
							priority: "Data Priority",
							briefing: "AI Briefing",
							interests: "Interests",
							diary: "Diary",
							profile: "Profile",
						},
						fontSizes: {
							small: "Small",
							medium: "Default",
							large: "Large",
						},
						widgetNames: {
							health: "Health (Google Fit)",
							calendar: "Calendar (Google)",
							briefing: "AI Briefing",
							trends: "Live Trends",
							stocks: "Stocks/Exchange",
							weather: "Weather",
							news: "News",
							smart: "Smart Widget",
						},
						widgets: {
							fontSize: "Font size",
							fontSizeDesc: "Applied across all widgets.",
							intro:
								"Toggle your default widgets here. Hidden widgets can be re-enabled at any time.",
							off: "Off",
						},
						smart: {
							intro:
								"Manage smart widgets. Add keywords to let AI automatically collect related data.",
							badge: "Smart",
							off: "Off",
							keywordWidgets: "AI keyword widgets",
							ready: "AI ready",
							pending: "Pending",
							deleteTitle: "Delete smart widget",
							deleteMessage: (kw) => `Delete the '${kw}' widget?`,
							delete: "Delete",
							placeholder: "Enter keyword...",
							add: "Add",
						},
						profile: {
							noLogin: "No login info",
							restartOnboarding: "🔄 Restart onboarding",
							profileAlt: "Profile",
						},
						priority: {
							title: "Data priority",
							desc:
								"Drag to reorder. Higher-ranked data is mentioned first in AI briefings.",
							reset: "🔄 Reset to default order",
						},
						briefing: {
							title: "AI briefing settings",
							desc: "Manage AI briefing-related settings.",
							firstVisit: "Detailed briefing on first visit",
							firstVisitDesc:
								"Automatically show a detailed briefing the first time you open a tab after midnight.",
							factualTitle: "Factual-only mode",
							factualDesc:
								"AI briefings and diaries are generated using facts only. Emotional phrasing, comparisons, and predictions are automatically excluded.",
						},
						interests: {
							title: "Interest keywords",
							desc:
								"Keywords automatically extracted from Q&A and diary entries. You can also add or remove them manually.",
							placeholder: "Type a keyword and press Enter",
							fixedTitle: "Fixed interests",
							fixedBadge: "Fixed",
							fixedSource: "Onboarding",
							noDynamic:
								"No dynamic interests yet. Diary and Q&A activity will add more over time.",
							empty:
								"No interest keywords have been collected yet.\nAnswer daily questions or write a diary entry and more will be extracted the next day.",
							resetTitle: "Reset interests",
							resetMessage: "Reset all interest keywords and accumulated scores?",
							resetButton: "Reset all interests",
						},
						selected: "Selected",
				  },
		[isKo],
	);

	// Confirm dialog state: null | { title, message, onConfirm }
	const [confirmState, setConfirmState] = useState(null);
	const [showPinModal, setShowPinModal] = useState(false);
	const [pinModalMode, setPinModalMode] = useState("setup");
	const fixedInterests = useMemo(
		() => buildFixedInterests(fixedInterestIds),
		[fixedInterestIds],
	);
	const pinLockOptions = PIN_LOCK_OPTIONS.filter(
		(option) => option.id !== "off",
	);
	const openConfirm = (title, message, onConfirm) =>
		setConfirmState({ title, message, onConfirm });
	const closeConfirm = () => setConfirmState(null);

	const handlePinLockModeChange = (mode) => {
		setPinLockMode(mode);
		applyPinLockMode(mode);
	};
	const openPinFlow = (mode) => {
		setPinModalMode(mode);
		setShowPinModal(true);
	};

	// Get widget labels for priority display
	const getWidgetLabel = (widgetId) => {
		return settingsCopy.widgetNames[widgetId] || widgetId;
	};

	// Handle priority DnD reorder
	const handlePriorityDragEnd = (result) => {
		if (!result.destination) return;
		const newOrder = Array.from(priorityOrder);
		const [removed] = newOrder.splice(result.source.index, 1);
		newOrder.splice(result.destination.index, 0, removed);
		setPriorityOrder(newOrder);
	};

	if (!showSettings) return null;

	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[20500] p-4">
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
					<h2 className="text-lg font-bold">{settingsCopy.title}</h2>
					<button onClick={() => setShowSettings(false)}>
						<X size={20} className="opacity-60 hover:opacity-100" />
					</button>
				</div>
				<div className="flex min-h-[400px]">
					<div
						className={`w-44 border-r p-4 space-y-1 ${isDark ? "border-white/10" : "border-gray-200"}`}
					>
						{[
							{ id: "widgets", label: settingsCopy.tabs.widgets },
							{ id: "smart", label: settingsCopy.tabs.smart },
							{ id: "priority", label: settingsCopy.tabs.priority },
							{ id: "briefing", label: settingsCopy.tabs.briefing },
							{ id: "interests", label: settingsCopy.tabs.interests },
							{ id: "diary", label: settingsCopy.tabs.diary },
							{ id: "profile", label: settingsCopy.tabs.profile },
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
								<div
									className={`rounded-2xl border p-4 ${
										isDark
											? "border-white/10 bg-white/5"
											: "border-gray-200 bg-gray-50"
									}`}
								>
									<p className="text-sm font-medium">{settingsCopy.widgets.fontSize}</p>
									<p className={`text-xs mt-1 ${muted}`}>
										{settingsCopy.widgets.fontSizeDesc}
									</p>
									<div className="grid grid-cols-3 gap-2 mt-3">
										{FONT_SIZE_OPTIONS.map(({ key }) => (
											<button
												key={key}
												onClick={() => setGlobalFontSize(key)}
												className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
													globalFontSize === key
														? "bg-blue-500 text-white border-blue-500"
														: isDark
															? "border-white/15 bg-white/5 hover:bg-white/10"
													: "border-gray-200 bg-white hover:bg-gray-100"
												}`}
											>
												{settingsCopy.fontSizes[key]}
											</button>
										))}
									</div>
								</div>
								<p className={`text-xs mb-2 ${muted}`}>
									{settingsCopy.widgets.intro}
								</p>
								{WIDGET_LIST.filter((w) => w.category === "core").map((w) => (
									<div
										key={w.id}
										className={`flex items-center justify-between p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
									>
										<div className="flex items-center gap-2">
											<span className="text-sm">{getWidgetLabel(w.id)}</span>
											{!vis[w.id] && (
												<span
													className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-red-500/20 text-red-300" : "bg-red-100 text-red-600"}`}
												>
													{settingsCopy.widgets.off}
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
									{settingsCopy.smart.intro}
								</p>
								{WIDGET_LIST.filter((w) => w.category === "smart").map((w) => (
									<div
										key={w.id}
										className={`flex items-center justify-between p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
									>
										<div className="flex items-center gap-2">
											<Sparkles
												size={14}
												className={
													isDark ? "text-yellow-300" : "text-yellow-600"
												}
											/>
											<span className="text-sm font-medium">{getWidgetLabel(w.id)}</span>
											<span
												className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-700"}`}
											>
												{settingsCopy.smart.badge}
											</span>
											{!vis[w.id] && (
												<span
													className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-red-500/20 text-red-300" : "bg-red-100 text-red-600"}`}
												>
													{settingsCopy.smart.off}
												</span>
											)}
										</div>
										<Toggle on={vis[w.id]} onToggle={() => toggleVis(w.id)} />
									</div>
								))}
								{smartKeywords.length > 0 && (
									<div
										className={`border-t pt-4 mt-4 ${isDark ? "border-white/10" : "border-gray-200"}`}
									>
										<p className={`text-xs font-medium mb-3 ${muted}`}>
											{settingsCopy.smart.keywordWidgets}
										</p>
									</div>
								)}
								{smartKeywords.map((kw) => (
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
												{smartWidgetData[kw]?.emoji || "🔍"} {kw}
											</span>
											{smartWidgetData[kw] ? (
												<span
													className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-green-500/20 text-green-300" : "bg-green-100 text-green-700"}`}
												>
													{settingsCopy.smart.ready}
												</span>
											) : (
												<span
													className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-orange-500/20 text-orange-300" : "bg-orange-100 text-orange-700"}`}
												>
													{settingsCopy.smart.pending}
												</span>
											)}
										</div>
										<button
											onClick={() =>
												openConfirm(
													settingsCopy.smart.deleteTitle,
													settingsCopy.smart.deleteMessage(kw),
													() => { removeSmartWidget(kw); closeConfirm(); },
												)
											}
											className="text-red-400 hover:text-red-300 text-xs"
										>
											{settingsCopy.smart.delete}
										</button>
									</div>
								))}
								<div className="flex gap-2 mt-3">
									<input
										type="text"
										value={newKeyword}
										onChange={(e) => setNewKeyword(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && addSmartWidget()}
										placeholder={settingsCopy.smart.placeholder}
										className={`flex-grow rounded-xl px-4 py-2.5 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
									/>
									<button
										onClick={addSmartWidget}
										className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold"
									>
										{settingsCopy.smart.add}
									</button>
								</div>
							</div>
						)}
						{false && settingsTab === "routine" && (
							<div className="space-y-4">
								<p className={`text-xs mb-2 ${muted}`}>
									매일 반복할 루틴 Task를 등록합니다. 일반 Task는 일일 리셋 시
									초기화되고, 루틴 Task는 자동으로 다시 나타납니다.
								</p>
								<div className="flex gap-2">
									<input
										type="text"
										value={newRoutineText}
										onChange={(e) => setNewRoutineText(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && addRecurringTodo()}
										placeholder="예: 아침 스트레칭 10분"
										className={`flex-grow rounded-xl px-4 py-2.5 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
									/>
									<button
										onClick={addRecurringTodo}
										className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold"
									>
										루틴 추가
									</button>
								</div>

								<div className="space-y-2">
									{recurringTodos.length === 0 && (
										<p className={`text-xs ${muted}`}>
											등록된 루틴이 없습니다.
										</p>
									)}
									{recurringTodos.map((todo) => (
										<div
											key={todo.id}
											className={`flex items-center justify-between p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
										>
											<div className="flex items-center gap-2">
												<span
													className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}
												>
													루틴
												</span>
												<span className="text-sm">{todo.text}</span>
											</div>
											<button
												onClick={() =>
													openConfirm(
														"루틴 삭제",
														`'${todo.text}' 루틴을 삭제하시겠습니까?`,
														() => { deleteTodo(todo.id); closeConfirm(); },
													)
												}
												className="text-red-400 hover:text-red-300 text-xs"
											>
												삭제
											</button>
										</div>
									))}
								</div>
							</div>
						)}
						{settingsTab === "diary" && (
							<div className="space-y-6">
								<div>
									<p className="text-sm font-medium mb-2">Diary settings</p>
									<p className={`text-xs mb-4 ${muted}`}>
										Manage diary protection and choose which language newly generated diaries should use.
									</p>
								</div>

								<>
										<div
											className={`p-4 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}
										>
											<div className="flex items-start justify-between gap-4 flex-wrap">
												<div className="flex items-start gap-3 flex-1 min-w-0">
													<div
														className={`p-2 rounded-lg ${isDark ? "bg-blue-500/15" : "bg-blue-100"}`}
													>
														<Lock size={18} className="text-blue-500" />
													</div>
													<div className="flex-1 min-w-0 space-y-1">
														<div className="flex items-center justify-between gap-3">
															<p className="text-sm font-medium">
																{pinSet ? "PIN is set" : "PIN is not set"}
															</p>
															<div className="flex flex-col items-end gap-1">
																<Toggle
																	on={pinSet}
																	onToggle={() =>
																		openPinFlow(pinSet ? "disable" : "setup")
																	}
																/>
																<p className={`text-[11px] ${muted}`}>
																	{pinSet ? "PIN on" : "PIN off"}
																</p>
															</div>
														</div>
														<p className={`text-xs mt-1 ${muted}`}>
															{pinSet
																? "You can change your PIN, disable it, or adjust the lock timing below."
																: "Once you set a PIN, PIN change and lock timing controls will appear here."}
														</p>
													</div>
												</div>

												<div className="flex flex-col items-end gap-2">
													{pinSet && (
														<button
															onClick={() => openPinFlow("change")}
															className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
																isDark
																	? "border-white/15 bg-white/5 hover:bg-white/10"
																	: "border-gray-200 bg-white hover:bg-gray-50"
															}`}
														>
															Change PIN
														</button>
													)}
												</div>
											</div>
										</div>

										<div
											className={`p-4 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}
										>
											<div className="space-y-3">
												<div>
													<p className="text-sm font-medium">Generation language</p>
													<p className={`text-xs mt-1 ${muted}`}>
														Choose the language used when AI creates a new diary entry.
													</p>
												</div>

												<div className="grid gap-2">
													{[
														{
															id: "app",
															label: isKo ? "앱 언어 따라가기" : "Follow app language",
															description:
																isKo
																	? "일기를 생성할 때마다 현재 앱 언어를 사용합니다."
																	: "Use the current UI language each time a diary is generated.",
														},
														{
															id: "ko",
															label: isKo ? "한국어" : "Korean",
															description:
																isKo
																	? "일기 제목과 요약을 항상 한국어로 생성합니다."
																	: "Always generate diary titles and summaries in Korean.",
														},
														{
															id: "en",
															label: "English",
															description:
																isKo
																	? "일기 제목과 요약을 항상 영어로 생성합니다."
																	: "Always generate diary titles and summaries in English.",
														},
													].map((option) => {
														const selected = diaryLanguage === option.id;
														return (
															<button
																key={option.id}
																onClick={() => setDiaryLanguage(option.id)}
																className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
																	selected
																		? isDark
																			? "border-blue-400 bg-blue-500/15"
																			: "border-blue-500 bg-blue-50"
																		: isDark
																			? "border-white/10 bg-white/5 hover:bg-white/10"
																			: "border-gray-200 bg-white hover:bg-gray-50"
																}`}
															>
																<div className="flex items-center justify-between gap-3">
																	<p className="text-sm font-medium">{option.label}</p>
																	{selected && (
																		<span
																			className={`text-[11px] font-semibold ${
																				isDark ? "text-blue-300" : "text-blue-600"
																			}`}
																		>
																			{settingsCopy.selected}
																		</span>
																	)}
																</div>
																<p className={`text-xs mt-1 ${muted}`}>
																	{option.description}
																</p>
															</button>
														);
													})}
												</div>
											</div>
										</div>

										{pinSet && (
									<div
										className={`p-4 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}
									>
										<div className="space-y-3">
											<div>
												<p className="text-sm font-medium">Lock timing</p>
												<p className={`text-xs mt-1 ${muted}`}>
													Choose how long diary stays unlocked after a successful PIN check.
												</p>
											</div>

											<div className="grid gap-2">
												{pinLockOptions.map((option) => {
													const selected = pinLockMode === option.id;
													return (
														<button
															key={option.id}
															onClick={() => handlePinLockModeChange(option.id)}
															className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
																selected
																	? isDark
																		? "border-blue-400 bg-blue-500/15"
																		: "border-blue-500 bg-blue-50"
																	: isDark
																		? "border-white/10 bg-white/5 hover:bg-white/10"
																		: "border-gray-200 bg-white hover:bg-gray-50"
															}`}
														>
															<div className="flex items-center justify-between gap-3">
																<p className="text-sm font-medium">{option.label}</p>
																{selected && (
																	<span
																		className={`text-[11px] font-semibold ${
																			isDark ? "text-blue-300" : "text-blue-600"
																		}`}
																	>
																		Selected
																	</span>
																)}
															</div>
															<p className={`text-xs mt-1 ${muted}`}>
																{option.description}
															</p>
														</button>
													);
												})}
											</div>

											<p className={`text-xs ${muted}`}>
												{pinLockMode === "off"
													? "PIN exists, but diary protection is currently off. Choose a lock time to turn it back on."
													: pinLockMode === "immediate"
														? "Diary locks again as soon as you close it."
														: "After you unlock diary once, it stays open for the selected amount of time."}
											</p>
											</div>
										</div>
										)}
								</>
							</div>
						)}
						{false && settingsTab === "privacy" && (
							<div className="space-y-6">
								<div>
									<p className="text-sm font-medium mb-2">Diary PIN</p>
									<p className={`text-xs mb-4 ${muted}`}>
										일기와 일기 목록을 4자리 PIN으로 보호합니다.
									</p>
								</div>

								<div
									className={`p-4 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}
								>
									<div className="flex items-start justify-between gap-4">
										<div className="flex items-start gap-3">
											<div
												className={`p-2 rounded-lg ${isDark ? "bg-blue-500/15" : "bg-blue-100"}`}
											>
												<Lock size={18} className="text-blue-500" />
											</div>
											<div>
												<p className="text-sm font-medium">
													{pinSet ? "PIN이 설정되어 있어요" : "PIN이 아직 설정되지 않았어요"}
												</p>
												<p className={`text-xs mt-1 ${muted}`}>
													{pinSet
														? "현재 PIN을 확인한 뒤 새 PIN으로 변경할 수 있어요."
														: "처음 diary를 열기 전에 PIN을 먼저 설정하게 됩니다."}
												</p>
											</div>
										</div>

										<button
											onClick={() => {
												setPinModalMode(pinSet ? "change" : "setup");
												setShowPinModal(true);
											}}
											className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
										>
											{pinSet ? "PIN 변경" : "PIN 설정"}
										</button>
									</div>
								</div>

								<div
									className={`p-4 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}
								>
									<div className="space-y-3">
										<div>
											<p className="text-sm font-medium">잠금 방식</p>
											<p className={`text-xs mt-1 ${muted}`}>
												Diary PIN을 언제 다시 요구할지 정할 수 있어요.
											</p>
										</div>

										<div className="grid gap-2">
											{PIN_LOCK_OPTIONS.map((option) => {
												const selected = pinLockMode === option.id;
												return (
													<button
														key={option.id}
														onClick={() => handlePinLockModeChange(option.id)}
														className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
															selected
																? isDark
																	? "border-blue-400 bg-blue-500/15"
																	: "border-blue-500 bg-blue-50"
																: isDark
																	? "border-white/10 bg-white/5 hover:bg-white/10"
																	: "border-gray-200 bg-white hover:bg-gray-50"
														}`}
													>
														<div className="flex items-center justify-between gap-3">
															<p className="text-sm font-medium">{option.label}</p>
															{selected && (
																<span
																	className={`text-[11px] font-semibold ${
																		isDark ? "text-blue-300" : "text-blue-600"
																	}`}
																>
																	선택됨
																</span>
															)}
														</div>
														<p className={`text-xs mt-1 ${muted}`}>
															{option.description}
														</p>
													</button>
												);
											})}
										</div>

										<p className={`text-xs ${muted}`}>
											{pinLockMode === "off"
												? "PIN을 꺼두면 diary와 diary list를 바로 열 수 있어요."
												: pinSet
													? "PIN은 유지되고, 잠금 타이밍만 바뀝니다."
													: "잠금 방식을 켜두면 diary에 처음 들어갈 때 PIN 설정 팝업이 바로 열립니다."}
										</p>
									</div>
								</div>
							</div>
						)}
						{settingsTab === "profile" && (
							<div className="space-y-6">
								<div className="flex items-center gap-4">
									{useAuthStore.getState().user?.avatarUrl ? (
										<img
											src={useAuthStore.getState().user.avatarUrl}
											alt={settingsCopy.profile.profileAlt}
											className="w-16 h-16 rounded-full border-2 border-blue-400 object-cover"
										/>
									) : (
										<div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center border-2 border-blue-400">
											<User size={28} className="text-white" />
										</div>
									)}
									<div>
										<p className="font-bold">
											{useAuthStore.getState().user?.displayName || "MorningBrief.AI User"}
										</p>
										<p className={`text-xs ${muted}`}>
											{useAuthStore.getState().user?.email || settingsCopy.profile.noLogin}
										</p>
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
									{settingsCopy.profile.restartOnboarding}
								</button>
								<LogoutButton logout={logout} setShowSettings={setShowSettings} isDark={isDark} />
							</div>
						)}
						{settingsTab === "priority" && (
							<div className="space-y-4">
								<div>
									<p className="text-sm font-medium mb-2">{settingsCopy.priority.title}</p>
									<p className={`text-xs mb-4 ${muted}`}>
										{settingsCopy.priority.desc}
									</p>
								</div>
								<DragDropContext onDragEnd={handlePriorityDragEnd}>
									<Droppable droppableId="priority-list">
										{(provided) => (
											<div
												ref={provided.innerRef}
												{...provided.droppableProps}
												className="space-y-2"
											>
												{priorityOrder.map((widgetId, index) => (
													<Draggable
														key={widgetId}
														draggableId={widgetId}
														index={index}
													>
														{(provided, snapshot) => (
															<div
																ref={provided.innerRef}
																{...provided.draggableProps}
																{...provided.dragHandleProps}
																className={`flex items-center gap-3 p-3 rounded-xl ${
																	snapshot.isDragging
																		? "shadow-lg scale-[1.02] transition-all"
																		: ""
																} ${
																	isDark
																		? "bg-white/5 hover:bg-white/10"
																		: "bg-gray-50 hover:bg-gray-100"
																}`}
															>
																<div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
																	isDark ? "bg-blue-600/30 text-blue-300" : "bg-blue-100 text-blue-600"
																}`}>
																	{index + 1}
																</div>
																<GripVertical
																	size={16}
																	className={`${muted} cursor-grab`}
																/>
																<span className="text-sm flex-1">
																	{getWidgetLabel(widgetId)}
																</span>
															</div>
														)}
													</Draggable>
												))}
												{provided.placeholder}
											</div>
										)}
									</Droppable>
								</DragDropContext>
								<button
									onClick={() => setPriorityOrder(DEFAULT_PRIORITY_ORDER)}
									className={`w-full p-3 rounded-xl text-sm font-medium transition-colors ${
										isDark
											? "bg-white/5 hover:bg-white/10"
											: "bg-gray-50 hover:bg-gray-100"
									}`}
								>
									{settingsCopy.priority.reset}
								</button>
							</div>
						)}
						{settingsTab === "briefing" && (
							<div className="space-y-6">
								<div>
									<p className="text-sm font-medium mb-2">{settingsCopy.briefing.title}</p>
									<p className={`text-xs mb-4 ${muted}`}>
										{settingsCopy.briefing.desc}
									</p>
								</div>
								<div
									className={`flex items-center justify-between p-4 rounded-xl ${
										isDark ? "bg-white/5" : "bg-gray-50"
									}`}
								>
									<div className="flex-1">
										<p className="text-sm font-medium">{settingsCopy.briefing.firstVisit}</p>
										<p className={`text-xs mt-1 ${muted}`}>
											{settingsCopy.briefing.firstVisitDesc}
										</p>
									</div>
									<Toggle
										on={showFirstLoginBriefing}
										onToggle={() => setShowFirstLoginBriefing(!showFirstLoginBriefing)}
									/>
								</div>
								<div className={`p-4 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
									<div className="flex items-center gap-2 mb-2">
										<Sparkles size={16} className="text-blue-500" />
										<p className="text-sm font-medium">{settingsCopy.briefing.factualTitle}</p>
									</div>
									<p className={`text-xs ${muted}`}>
										{settingsCopy.briefing.factualDesc}
									</p>
								</div>
							</div>
						)}
						{settingsTab === "interests" && (
							<div className="space-y-4">
								<div>
									<p className="text-sm font-medium mb-1">{settingsCopy.interests.title}</p>
									<p className={`text-xs ${muted}`}>
										{settingsCopy.interests.desc}
									</p>
								</div>
								<div className="flex gap-2">
									<input
										type="text"
										value={newInterestKeyword}
										onChange={(e) => setNewInterestKeyword(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && newInterestKeyword.trim()) {
												addKeywordInterest(newInterestKeyword.trim());
												setNewInterestKeyword("");
											}
										}}
										placeholder={settingsCopy.interests.placeholder}
										className={`flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-blue-500/30 ${
											isDark
												? "bg-white/5 border-white/10 text-white placeholder:text-white/30"
												: "bg-gray-50 border-gray-200 text-slate-800 placeholder:text-gray-400"
										}`}
									/>
									<button
										onClick={() => {
											if (newInterestKeyword.trim()) {
												addKeywordInterest(newInterestKeyword.trim());
												setNewInterestKeyword("");
											}
										}}
										className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
									>
										<Plus size={14} />
									</button>
								</div>
								{fixedInterests.length > 0 && (
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<Heart size={16} className="text-rose-400" />
											<p className="text-sm font-medium">{settingsCopy.interests.fixedTitle}</p>
										</div>
										<div className="space-y-2">
											{fixedInterests.map((item) => (
												<div
													key={`fixed-${item.id}`}
													className={`flex items-center justify-between px-3 py-2 rounded-lg ${
														isDark ? "bg-white/5" : "bg-gray-50"
													}`}
												>
													<div className="flex items-center gap-2 min-w-0">
														<span
															className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
																isDark
																	? "bg-rose-500/20 text-rose-300"
																	: "bg-rose-100 text-rose-600"
															}`}
														>
															{settingsCopy.interests.fixedBadge}
														</span>
														<span className="text-sm truncate">
															{getFixedInterestLabel(item.id)}
														</span>
													</div>
													<span className={`text-[10px] flex-shrink-0 ${muted}`}>
														{settingsCopy.interests.fixedSource}
													</span>
												</div>
											))}
										</div>
									</div>
								)}
								{keywordInterests.length === 0 && fixedInterests.length > 0 && (
									<p className={`text-xs ${muted}`}>
										{settingsCopy.interests.noDynamic}
									</p>
								)}
								{keywordInterests.length === 0 && fixedInterests.length === 0 ? (
									<div className={`p-4 rounded-xl text-center ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
										<Heart size={20} className={`mx-auto mb-2 ${muted}`} />
										<p className={`text-xs ${muted}`}>
											{settingsCopy.interests.empty.split("\n").map((line, index) => (
												<span key={index}>
													{index > 0 && <br />}
													{line}
												</span>
											))}
										</p>
									</div>
								) : (
									<div className="space-y-2 max-h-64 overflow-y-auto pr-1">
										{keywordInterests.map((item) => (
											<div
												key={item.keyword}
												className={`flex items-center justify-between px-3 py-2 rounded-lg ${
													isDark ? "bg-white/5" : "bg-gray-50"
												}`}
											>
												<div className="flex items-center gap-2 min-w-0">
													<span
														className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
															isDark
																? "bg-blue-500/20 text-blue-300"
																: "bg-blue-100 text-blue-600"
														}`}
													>
														{item.category}
													</span>
													<span className="text-sm truncate">{item.keyword}</span>
													<span className={`text-[10px] flex-shrink-0 ${muted}`}>
														{typeof item.score === "number" ? item.score.toFixed(1) : ""}
													</span>
												</div>
												<button
													onClick={() => removeKeywordInterest(item.keyword)}
													className={`p-1 rounded transition-colors flex-shrink-0 ${
														isDark
															? "hover:bg-red-500/20 text-white/40 hover:text-red-300"
															: "hover:bg-red-50 text-gray-400 hover:text-red-500"
													}`}
												>
													<Trash2 size={12} />
												</button>
											</div>
										))}
									</div>
								)}
								{keywordInterests.length > 0 && (
									<button
										onClick={() =>
											openConfirm(
												settingsCopy.interests.resetTitle,
												settingsCopy.interests.resetMessage,
												() => {
													resetKeywordInterests();
													closeConfirm();
												}
											)
										}
										className={`w-full p-2.5 rounded-xl text-sm text-left ${
											isDark
												? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
												: "bg-red-50 text-red-500 hover:bg-red-100"
										} transition-colors`}
									>
										{settingsCopy.interests.resetButton}
									</button>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{confirmState && (
				<ConfirmDialog
					title={confirmState.title}
					message={confirmState.message}
					onConfirm={confirmState.onConfirm}
					onCancel={closeConfirm}
				/>
			)}
				{showPinModal && (
					<PINModal
						mode={pinModalMode}
						onSuccess={() => setShowPinModal(false)}
						onCancel={() => setShowPinModal(false)}
					/>
				)}
		</div>
	);
};

export default SettingsModal;
