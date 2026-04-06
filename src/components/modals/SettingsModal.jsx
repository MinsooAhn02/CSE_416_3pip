import { useRef, useState } from "react";
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
	Clock,
	Calendar,
	Timer,
	ListOrdered,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useTodoStore } from "../../store/useTodoStore";
import { WIDGET_LIST, STANDARD_WIDGETS, DEFAULT_PRIORITY_ORDER } from "../../constants";
import { save } from "../../utils/storage";
import Toggle from "../common/Toggle";

// Logout button with loading state and error handling
const LogoutButton = ({ logout, setShowSettings, isDark }) => {
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [error, setError] = useState(null);

	const handleLogout = async () => {
		setIsLoggingOut(true);
		setError(null);
		try {
			await logout();
			setShowSettings(false);
		} catch (e) {
			console.error("Logout failed:", e);
			setError("로그아웃 실패. 다시 시도해주세요.");
			setIsLoggingOut(false);
		}
	};

	return (
		<div className="space-y-1">
			<button
				onClick={handleLogout}
				disabled={isLoggingOut}
				className={`w-full p-3 rounded-xl text-sm text-left bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
			>
				{isLoggingOut ? (
					<RefreshCw size={16} className="animate-spin" />
				) : (
					<LogOut size={16} />
				)}
				{isLoggingOut ? "로그아웃 중..." : "로그아웃"}
			</button>
			{error && <p className="text-xs text-red-400 px-1">{error}</p>}
		</div>
	);
};

const SettingsModal = () => {
	const { isDark, muted, inputCls } = useTheme();
	const {
		showSettings,
		settingsTab,
		theme,
		bgImage,
		clockStyle,
		priorityOrder,
		showFirstLoginBriefing,
		setShowSettings,
		setSettingsTab,
		setTheme,
		setBgImage,
		removeBg,
		setClockStyle,
		setPriorityOrder,
		setShowFirstLoginBriefing,
	} = useSettingsStore();
	const {
		vis,
		smartKeywords,
		smartWidgetData,
		newKeyword,
		toggleVis,
		resetDndLayout,
		setNewKeyword,
		addSmartWidget,
		removeSmartWidget,
	} = useWidgetStore();
	const { logout, setShowOnboarding, setObStep } = useAuthStore();
	const todos = useTodoStore((s) => s.todos);
	const newRoutineText = useTodoStore((s) => s.newRoutineText);
	const setNewRoutineText = useTodoStore((s) => s.setNewRoutineText);
	const addRecurringTodo = useTodoStore((s) => s.addRecurringTodo);
	const deleteTodo = useTodoStore((s) => s.deleteTodo);
	const setOnboarded = (v) => {
		useAuthStore.setState({ onboarded: v });
		save("mb_onboarded", v);
	};
	const recurringTodos = todos.filter((t) => t.isFixed);

	const bgRef = useRef(null);

	// Get widget labels for priority display
	const getWidgetLabel = (widgetId) => {
		const widget = STANDARD_WIDGETS.find((w) => w.id === widgetId);
		return widget?.label || widgetId;
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
							{ id: "priority", label: "데이터 우선순위" },
							{ id: "routine", label: "고정 TODO" },
							{ id: "clock", label: "시계 스타일" },
							{ id: "layout", label: "레이아웃" },
							{ id: "briefing", label: "AI 브리핑" },
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
								{WIDGET_LIST.filter((w) => w.category === "core").map((w) => (
									<div
										key={w.id}
										className={`flex items-center justify-between p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
									>
										<div className="flex items-center gap-2">
											<span className="text-sm">{w.label}</span>
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
									스마트 위젯을 관리합니다. 키워드를 추가하면 AI가 관련 데이터를
									자동 수집합니다.
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
											<span className="text-sm font-medium">{w.label}</span>
											<span
												className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-700"}`}
											>
												Smart
											</span>
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
								{smartKeywords.length > 0 && (
									<div
										className={`border-t pt-4 mt-4 ${isDark ? "border-white/10" : "border-gray-200"}`}
									>
										<p className={`text-xs font-medium mb-3 ${muted}`}>
											AI 키워드 위젯
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
													AI 준비됨
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
								))}
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
						{settingsTab === "routine" && (
							<div className="space-y-4">
								<p className={`text-xs mb-2 ${muted}`}>
									매일 반복할 루틴 TODO를 등록합니다. 일반 TODO는 일일 리셋 시
									초기화되고, 루틴 TODO는 자동으로 다시 나타납니다.
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
												onClick={() => deleteTodo(todo.id)}
												className="text-red-400 hover:text-red-300 text-xs"
											>
												삭제
											</button>
										</div>
									))}
								</div>
							</div>
						)}
						{settingsTab === "clock" && (
							<div className="space-y-4">
								<p className={`text-xs mb-2 ${muted}`}>
									대시보드 상단의 시계 표시 형태를 선택하세요.
								</p>
								<div className="grid grid-cols-3 gap-3">
									{[
										{
											id: "digital",
											label: "디지털",
											desc: "기본 숫자 시계",
											icon: Timer,
										},
										{
											id: "dateInfo",
											label: "날짜 상세",
											desc: "연도·초 포함",
											icon: Calendar,
										},
										{
											id: "analog",
											label: "아날로그",
											desc: "원형 시계",
											icon: Clock,
										},
									].map((s) => (
										<button
											key={s.id}
											onClick={() => setClockStyle(s.id)}
											className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
												clockStyle === s.id
													? "border-blue-500 bg-blue-500/20"
													: isDark
														? "border-white/10 bg-white/5 hover:bg-white/10"
														: "border-gray-200 bg-gray-50 hover:bg-gray-100"
											}`}
										>
											<s.icon
												size={24}
												className={
													clockStyle === s.id ? "text-blue-400" : muted
												}
											/>
										<span className="text-sm font-bold">{s.label}</span>
										<span className={`text-[10px] font-bold ${muted}`}>{s.desc}</span>
										</button>
									))}
								</div>
							</div>
						)}
						{settingsTab === "layout" && (
							<div className="space-y-4">
								<p className={`text-xs mb-2 ${muted}`}>
									위젯을 드래그하여 원하는 위치로 이동할 수 있습니다. 위젯
									크기는 내용에 맞게 자동 조절됩니다.
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
											<p className="text-sm font-medium">자동 크기 조절</p>
											<p className={`text-xs ${muted}`}>
												위젯 높이가 내용에 맞게 자동으로 조절됩니다
											</p>
										</div>
									</div>
								</div>
								<button
									onClick={resetDndLayout}
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
									{useAuthStore.getState().user?.avatarUrl ? (
										<img
											src={useAuthStore.getState().user.avatarUrl}
											alt="프로필"
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
											{useAuthStore.getState().user?.email || "로그인 정보 없음"}
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
									🔄 온보딩 다시하기
								</button>
								<LogoutButton logout={logout} setShowSettings={setShowSettings} isDark={isDark} />
							</div>
						)}
						{settingsTab === "priority" && (
							<div className="space-y-4">
								<div>
									<p className="text-sm font-medium mb-2">데이터 우선순위</p>
									<p className={`text-xs mb-4 ${muted}`}>
										드래그하여 순서를 변경하세요. 높은 순위의 데이터가 AI 브리핑에서 먼저 언급됩니다.
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
									🔄 기본 순서로 초기화
								</button>
							</div>
						)}
						{settingsTab === "briefing" && (
							<div className="space-y-6">
								<div>
									<p className="text-sm font-medium mb-2">AI 브리핑 설정</p>
									<p className={`text-xs mb-4 ${muted}`}>
										AI 브리핑 관련 설정을 관리합니다.
									</p>
								</div>
								<div
									className={`flex items-center justify-between p-4 rounded-xl ${
										isDark ? "bg-white/5" : "bg-gray-50"
									}`}
								>
									<div className="flex-1">
										<p className="text-sm font-medium">첫 접속 상세 브리핑</p>
										<p className={`text-xs mt-1 ${muted}`}>
											자정 이후 첫 탭 열람 시 상세 브리핑을 자동으로 표시합니다.
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
										<p className="text-sm font-medium">Factual-Only 모드</p>
									</div>
									<p className={`text-xs ${muted}`}>
										AI 브리핑과 다이어리는 사실 기반으로만 생성됩니다. 감정적 표현, 비교, 예측은 자동으로 제외됩니다.
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default SettingsModal;
