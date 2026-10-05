import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useDialog } from "../../hooks/useDialog";
import {
	X,
	User,
	LogOut,
	GripVertical,
	RefreshCw,
	Sparkles,
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
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { useDiaryStore } from "../../store/useDiaryStore";
import { WIDGET_LIST, DEFAULT_PRIORITY_ORDER } from "../../constants";
import {
	buildFixedInterests,
	getFixedInterestLabel,
} from "../../utils/interests";
import Toggle from "../common/Toggle";
import ConfirmDialog from "../common/ConfirmDialog";
import PINModal from "./PINModal";
import DiaryEncryptionSettings from "../common/DiaryEncryptionSettings";

const FONT_SIZE_OPTIONS = [
	{ key: "small" as const },
	{ key: "medium" as const },
	{ key: "large" as const },
];

interface LogoutButtonProps {
	logout: () => Promise<void>;
	setShowSettings: (v: boolean) => void;
}

// Logout button with confirm dialog and loading state
const LogoutButton = ({ logout, setShowSettings }: LogoutButtonProps) => {
	const { t } = useTranslation();
	const [showConfirm, setShowConfirm] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleConfirmedLogout = async () => {
		setShowConfirm(false);
		setIsLoggingOut(true);
		setError(null);
		try {
			await logout();
			setShowSettings(false);
		} catch (e) {
			console.error("Logout failed:", e);
			setError(t("settings_modal.logout_tab.error"));
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
				{isLoggingOut ? t("settings_modal.logout_tab.logout_loading") : t("settings_modal.logout_tab.logout")}
			</button>
			{error && <p className="text-xs text-red-400 px-1">{error}</p>}
			{showConfirm && (
				<ConfirmDialog
					title={t("settings_modal.logout_tab.confirm_title")}
					message={t("settings_modal.logout_tab.confirm_message")}
					confirmLabel={t("settings_modal.logout_tab.logout")}
					onConfirm={handleConfirmedLogout}
					onCancel={() => setShowConfirm(false)}
				/>
			)}
		</div>
	);
};

const SettingsModal = () => {
	const { t } = useTranslation();
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
	} = useSettingsStore(
		useShallow((s) => ({
			showSettings: s.showSettings,
			settingsTab: s.settingsTab,
			priorityOrder: s.priorityOrder,
			showFirstLoginBriefing: s.showFirstLoginBriefing,
			fixedInterestIds: s.fixedInterestIds,
			keywordInterests: s.keywordInterests,
			setShowSettings: s.setShowSettings,
			setSettingsTab: s.setSettingsTab,
			pinLockMode: s.pinLockMode,
			setPriorityOrder: s.setPriorityOrder,
			setPinLockMode: s.setPinLockMode,
			diaryLanguage: s.diaryLanguage,
			setDiaryLanguage: s.setDiaryLanguage,
			setShowFirstLoginBriefing: s.setShowFirstLoginBriefing,
			addKeywordInterest: s.addKeywordInterest,
			removeKeywordInterest: s.removeKeywordInterest,
			resetKeywordInterests: s.resetKeywordInterests,
		})),
	);

	const [newInterestKeyword, setNewInterestKeyword] = useState("");
	const {
		vis,
		smartKeywords,
		smartWidgetData,
		newKeyword,
		globalFontSize,
		toggleVis,
		setVis,
		setNewKeyword,
		setGlobalFontSize,
		addSmartWidget,
		removeSmartWidget,
	} = useWidgetStore(
		useShallow((s) => ({
			vis: s.vis,
			smartKeywords: s.smartKeywords,
			smartWidgetData: s.smartWidgetData,
			newKeyword: s.newKeyword,
			globalFontSize: s.globalFontSize,
			toggleVis: s.toggleVis,
			setVis: s.setVis,
			setNewKeyword: s.setNewKeyword,
			setGlobalFontSize: s.setGlobalFontSize,
			addSmartWidget: s.addSmartWidget,
			removeSmartWidget: s.removeSmartWidget,
		})),
	);
	const logout = useAuthStore((s) => s.logout);
	const { setShowOnboarding, setObStep, setOnboarded, perms, savePerm } = useOnboardingStore(
		useShallow((s) => ({
			setShowOnboarding: s.setShowOnboarding,
			setObStep: s.setObStep,
			setOnboarded: s.setOnboarded,
			perms: s.perms,
			savePerm: s.savePerm,
		})),
	);
	const pinSet = useDiaryStore((s) => s.pinSet);
	const applyPinLockMode = useDiaryStore((s) => s.applyPinLockMode);
	const { ref: dialogRef, dialogProps } = useDialog<HTMLDivElement>({
		open: showSettings,
		onClose: () => setShowSettings(false),
		labelledBy: "settings-modal-title",
	});

	// Confirm dialog state: null | { title, message, onConfirm }
	const [confirmState, setConfirmState] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
	const [showPinModal, setShowPinModal] = useState(false);
	const [pinModalMode, setPinModalMode] = useState<"setup" | "verify" | "change" | "disable">("setup");
	const fixedInterests = useMemo(
		() => buildFixedInterests(fixedInterestIds),
		[fixedInterestIds],
	);
	const pinLockOptions = PIN_LOCK_OPTIONS.filter(
		(option) => option.id !== "off",
	);
	const diaryLanguageOptions = (["app", "ko", "en"] as const).map((id) => ({
		id,
		label: t(`settings_modal.diary_tab.lang_${id}_label`),
		description: t(`settings_modal.diary_tab.lang_${id}_desc`),
	}));
	const localizedPinLockOptions = pinLockOptions.map((option) => ({
		...option,
		label: t(`settings_modal.diary_tab.lock_${option.id}_label`),
		description: t(`settings_modal.diary_tab.lock_${option.id}_desc`),
	}));
	const openConfirm = (title: string, message: string, onConfirm: () => void) =>
		setConfirmState({ title, message, onConfirm });
	const closeConfirm = () => setConfirmState(null);

	const handlePinLockModeChange = (mode: string) => {
		setPinLockMode(mode);
		applyPinLockMode(mode);
	};
	const openPinFlow = (mode: "setup" | "verify" | "change" | "disable") => {
		setPinModalMode(mode);
		setShowPinModal(true);
	};

	// Get widget labels for priority display
	const getWidgetLabel = (widgetId: string) => {
		if (widgetId.startsWith("smart_")) {
			const kw = widgetId.slice(6);
			return `✨ ${kw}`;
		}
		return t(`settings_modal.widget_names.${widgetId}`, { defaultValue: widgetId });
	};

	// Effective priority order: core widgets + individual smart widgets
	const effectivePriorityOrder = useMemo(() => {
		// Remove legacy "smart" group entry, keep individual smart_xxx entries
		const withoutSmartGroup = priorityOrder.filter((id) => id !== "smart");
		// Append any new smart keywords not yet in the order
		const existing = new Set(withoutSmartGroup);
		const result = [...withoutSmartGroup];
		for (const kw of smartKeywords) {
			if (!existing.has(`smart_${kw}`)) result.push(`smart_${kw}`);
		}
		// Remove entries for smart keywords that no longer exist
		const validSmartIds = new Set(smartKeywords.map((kw) => `smart_${kw}`));
		return result.filter((id) => !id.startsWith("smart_") || validSmartIds.has(id));
	}, [priorityOrder, smartKeywords]);

	// Handle priority DnD reorder
	const handlePriorityDragEnd = (result: { destination?: { index: number } | null; source: { index: number } }) => {
		if (!result.destination) return;
		const newOrder = Array.from(effectivePriorityOrder);
		const [removed] = newOrder.splice(result.source.index, 1);
		newOrder.splice(result.destination.index, 0, removed);
		setPriorityOrder(newOrder);
	};

	if (!showSettings) return null;

	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[20500] p-4">
			<div
				ref={dialogRef}
				{...dialogProps}
				className={`w-full max-w-2xl rounded-3xl shadow-2xl border overflow-hidden flex flex-col h-[640px] max-h-[85vh] ${
					isDark
						? "bg-slate-800 border-white/20 text-white"
						: "bg-white border-gray-200 text-slate-800"
				}`}
			>
				<div
					className={`flex-shrink-0 flex items-center justify-between p-6 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}
				>
					<h2 id="settings-modal-title" className="text-lg font-bold">{t("settings_modal.title")}</h2>
					<button onClick={() => setShowSettings(false)} aria-label={t("common.close")}>
						<X size={20} className="opacity-60 hover:opacity-100" />
					</button>
				</div>
				<div className="flex flex-1 min-h-0 overflow-hidden">
					<div
						className={`w-44 flex-shrink-0 border-r p-4 space-y-1 overflow-y-auto ${isDark ? "border-white/10" : "border-gray-200"}`}
					>
						{[
							{ id: "widgets", label: t("settings_modal.tabs.widgets") },
							{ id: "smart", label: t("settings_modal.tabs.smart") },
							{ id: "priority", label: t("settings_modal.tabs.priority") },
							{ id: "briefing", label: t("settings_modal.tabs.briefing") },
							{ id: "interests", label: t("settings_modal.tabs.interests") },
							{ id: "diary", label: t("settings_modal.tabs.diary") },
							{ id: "profile", label: t("settings_modal.tabs.profile") },
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
					<div className="flex-1 p-6 overflow-y-auto min-h-0">
						{settingsTab === "widgets" && (
							<div className="space-y-3">
								<div
									className={`rounded-2xl border p-4 ${
										isDark
											? "border-white/10 bg-white/5"
											: "border-gray-200 bg-gray-50"
									}`}
								>
									<p className="text-sm font-medium">
										{t("settings_modal.widgets_tab.font_size")}
									</p>
									<p className={`text-xs mt-1 ${muted}`}>
										{t("settings_modal.widgets_tab.font_size_desc")}
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
												{t(`settings_modal.font_sizes.${key}`)}
											</button>
										))}
									</div>
								</div>
								<p className={`text-xs mb-2 ${muted}`}>
									{t("settings_modal.widgets_tab.intro")}
								</p>
								{WIDGET_LIST.filter((w) => w.category === "core" && w.id !== "briefing" && w.id !== "health" && w.id !== "calendar").map((w) => (
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
													{t("settings_modal.widgets_tab.off")}
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
									{t("settings_modal.smart_tab.intro")}
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
											<span className="text-sm font-medium">
												{getWidgetLabel(w.id)}
											</span>
											<span
												className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-700"}`}
											>
												{t("settings_modal.smart_tab.badge")}
											</span>
											{!vis[w.id] && (
												<span
													className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-red-500/20 text-red-300" : "bg-red-100 text-red-600"}`}
												>
													{t("settings_modal.smart_tab.off")}
												</span>
											)}
										</div>
										<Toggle on={vis[w.id]} onToggle={() => toggleVis(w.id)} />
									</div>
								))}
								<div
									className={`border-t pt-4 mt-4 ${isDark ? "border-white/10" : "border-gray-200"}`}
								>
									<p className={`text-xs font-medium mb-3 ${muted}`}>
										{t("settings_modal.smart_tab.keyword_widgets")}
									</p>
								</div>
								<div className="flex gap-2">
									<input
										type="text"
										value={newKeyword}
										onChange={(e) => setNewKeyword(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && addSmartWidget()}
										placeholder={t("settings_modal.smart_tab.placeholder")}
										className={`flex-grow rounded-xl px-4 py-2.5 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
									/>
									<button
										onClick={addSmartWidget}
										className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold"
									>
										{t("settings_modal.smart_tab.add")}
									</button>
								</div>
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
													{t("settings_modal.smart_tab.ready")}
												</span>
											) : (
												<span
													className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-orange-500/20 text-orange-300" : "bg-orange-100 text-orange-700"}`}
												>
													{t("settings_modal.smart_tab.pending")}
												</span>
											)}
										</div>
										<button
											onClick={() =>
												openConfirm(
													t("settings_modal.smart_tab.delete_title"),
													t("settings_modal.smart_tab.delete_message", { kw }),
													() => {
														removeSmartWidget(kw);
														closeConfirm();
													},
												)
											}
											className="text-red-400 hover:text-red-300 text-xs"
										>
											{t("settings_modal.smart_tab.delete")}
										</button>
									</div>
								))}
							</div>
						)}
						{settingsTab === "diary" && (
							<div className="space-y-6">
								<div>
									<p className="text-sm font-medium mb-2">
										{t("settings_modal.diary_tab.title")}
									</p>
									<p className={`text-xs mb-4 ${muted}`}>
										{t("settings_modal.diary_tab.desc")}
									</p>
								</div>

								<>
									<DiaryEncryptionSettings />

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
															{pinSet
																? t("settings_modal.diary_tab.pin_set")
																: t("settings_modal.diary_tab.pin_not_set")}
														</p>
														<div className="flex flex-col items-end gap-1">
															<Toggle
																on={pinSet}
																onToggle={() =>
																	openPinFlow(pinSet ? "disable" : "setup")
																}
															/>
															<p className={`text-[11px] ${muted}`}>
																{pinSet
																	? t("settings_modal.diary_tab.pin_on")
																	: t("settings_modal.diary_tab.pin_off")}
															</p>
														</div>
													</div>
													<p className={`text-xs mt-1 ${muted}`}>
														{pinSet
															? t("settings_modal.diary_tab.pin_set_desc")
															: t("settings_modal.diary_tab.pin_not_set_desc")}
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
														{t("settings_modal.diary_tab.change_pin")}
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
												<p className="text-sm font-medium">
													{t("settings_modal.diary_tab.generation_language")}
												</p>
												<p className={`text-xs mt-1 ${muted}`}>
													{t("settings_modal.diary_tab.generation_language_desc")}
												</p>
											</div>

											<div className="grid gap-2">
												{diaryLanguageOptions.map((option) => {
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
																<p className="text-sm font-medium">
																	{option.label}
																</p>
																{selected && (
																	<span
																		className={`text-[11px] font-semibold ${
																			isDark ? "text-blue-300" : "text-blue-600"
																		}`}
																	>
																		{t("settings_modal.selected")}
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
													<p className="text-sm font-medium">
														{t("settings_modal.diary_tab.lock_timing")}
													</p>
													<p className={`text-xs mt-1 ${muted}`}>
														{t("settings_modal.diary_tab.lock_timing_desc")}
													</p>
												</div>

												<div className="grid gap-2">
													{localizedPinLockOptions.map((option) => {
														const selected = pinLockMode === option.id;
														return (
															<button
																key={option.id}
																onClick={() =>
																	handlePinLockModeChange(option.id)
																}
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
																	<p className="text-sm font-medium">
																		{option.label}
																	</p>
																	{selected && (
																		<span
																			className={`text-[11px] font-semibold ${
																				isDark
																					? "text-blue-300"
																					: "text-blue-600"
																			}`}
																		>
																			{t("settings_modal.selected")}
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
														? t("settings_modal.diary_tab.lock_off_info")
														: pinLockMode === "immediate"
															? t("settings_modal.diary_tab.lock_immediate_info")
															: t("settings_modal.diary_tab.lock_delayed_info")}
												</p>
											</div>
										</div>
									)}
								</>
							</div>
						)}
						{settingsTab === "profile" && (
							<div className="space-y-6">
								<div className="flex items-center gap-4">
									{useAuthStore.getState().user?.avatarUrl ? (
										<img
											src={useAuthStore.getState().user!.avatarUrl!}
											alt={t("settings_modal.profile_tab.profile_alt")}
											className="w-16 h-16 rounded-full border-2 border-blue-400 object-cover"
										/>
									) : (
										<div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center border-2 border-blue-400">
											<User size={28} className="text-white" />
										</div>
									)}
									<div>
										<p className="font-bold">
											{useAuthStore.getState().user?.displayName ||
												"MorningBriefing.AI User"}
										</p>
										<p className={`text-xs ${muted}`}>
											{useAuthStore.getState().user?.email ||
												t("settings_modal.profile_tab.no_login")}
										</p>
									</div>
								</div>
								<div
									className={`rounded-2xl border p-4 space-y-3 ${isDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"}`}
								>
									<div>
										<p className="text-sm font-medium">
											{t("settings_modal.profile_tab.connected_services")}
										</p>
										<p className={`text-xs mt-1 ${muted}`}>
											{t("settings_modal.profile_tab.connected_services_desc")}
										</p>
									</div>
									{[
										{ key: "cal" as const, visId: "calendar", label: t("settings_modal.profile_tab.google_calendar"), desc: t("settings_modal.profile_tab.google_calendar_desc") },
										{ key: "fit" as const, visId: "health", label: t("settings_modal.profile_tab.google_fit"), desc: t("settings_modal.profile_tab.google_fit_desc") },
									].map(({ key, visId, label, desc }) => (
										<div key={key} className={`flex items-center justify-between p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-white border border-gray-200"}`}>
											<div>
												<p className="text-sm font-medium">{label}</p>
												<p className={`text-xs ${muted}`}>{desc}</p>
											</div>
											<Toggle
												on={perms[key]}
												onToggle={() => {
													const next = !perms[key];
													savePerm(key, next);
													setVis((prev) => ({ ...prev, [visId]: next }));
												}}
											/>
										</div>
									))}
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
									{t("settings_modal.profile_tab.restart_onboarding")}
								</button>
								<LogoutButton
									logout={logout}
									setShowSettings={setShowSettings}
								/>
							</div>
						)}
						{settingsTab === "priority" && (
							<div className="space-y-4">
								<div>
									<p className="text-sm font-medium mb-2">
										{t("settings_modal.priority_tab.title")}
									</p>
									<p className={`text-xs mb-4 ${muted}`}>
										{t("settings_modal.priority_tab.desc")}
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
												{effectivePriorityOrder.map((widgetId, index) => (
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
																<div
																	className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
																		isDark
																			? "bg-blue-600/30 text-blue-300"
																			: "bg-blue-100 text-blue-600"
																	}`}
																>
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
									onClick={() => setPriorityOrder([...DEFAULT_PRIORITY_ORDER, ...smartKeywords.map((kw) => `smart_${kw}`)])}
									className={`w-full p-3 rounded-xl text-sm font-medium transition-colors ${
										isDark
											? "bg-white/5 hover:bg-white/10"
											: "bg-gray-50 hover:bg-gray-100"
									}`}
								>
									{t("settings_modal.priority_tab.reset")}
								</button>
							</div>
						)}
						{settingsTab === "briefing" && (
							<div className="space-y-6">
								<div>
									<p className="text-sm font-medium mb-2">
										{t("settings_modal.briefing_tab.title")}
									</p>
									<p className={`text-xs mb-4 ${muted}`}>
										{t("settings_modal.briefing_tab.desc")}
									</p>
								</div>
								<div
									className={`flex items-center justify-between p-4 rounded-xl ${
										isDark ? "bg-white/5" : "bg-gray-50"
									}`}
								>
									<div className="flex-1">
										<p className="text-sm font-medium">
											{t("settings_modal.briefing_tab.first_visit")}
										</p>
										<p className={`text-xs mt-1 ${muted}`}>
											{t("settings_modal.briefing_tab.first_visit_desc")}
										</p>
									</div>
									<Toggle
										on={showFirstLoginBriefing}
										onToggle={() =>
											setShowFirstLoginBriefing(!showFirstLoginBriefing)
										}
									/>
								</div>
								<div
									className={`p-4 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
								>
									<div className="flex items-center gap-2 mb-2">
										<Sparkles size={16} className="text-blue-500" />
										<p className="text-sm font-medium">
											{t("settings_modal.briefing_tab.factual_title")}
										</p>
									</div>
									<p className={`text-xs ${muted}`}>
										{t("settings_modal.briefing_tab.factual_desc")}
									</p>
								</div>
							</div>
						)}
						{settingsTab === "interests" && (
							<div className="space-y-4">
								<div>
									<p className="text-sm font-medium mb-1">
										{t("settings_modal.interests_tab.title")}
									</p>
									<p className={`text-xs ${muted}`}>
										{t("settings_modal.interests_tab.desc")}
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
										placeholder={t("settings_modal.interests_tab.placeholder")}
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
										aria-label={t("common.add")}
										className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
									>
										<Plus size={14} />
									</button>
								</div>
								{fixedInterests.length > 0 && (
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<Heart size={16} className="text-rose-400" />
											<p className="text-sm font-medium">
												{t("settings_modal.interests_tab.fixed_title")}
											</p>
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
															{t("settings_modal.interests_tab.fixed_badge")}
														</span>
														<span className="text-sm truncate">
															{getFixedInterestLabel(item.id)}
														</span>
													</div>
													<span
														className={`text-[10px] flex-shrink-0 ${muted}`}
													>
														{t("settings_modal.interests_tab.fixed_source")}
													</span>
												</div>
											))}
										</div>
									</div>
								)}
								{keywordInterests.length === 0 && fixedInterests.length > 0 && (
									<p className={`text-xs ${muted}`}>
										{t("settings_modal.interests_tab.no_dynamic")}
									</p>
								)}
								{keywordInterests.length === 0 &&
								fixedInterests.length === 0 ? (
									<div
										className={`p-4 rounded-xl text-center ${isDark ? "bg-white/5" : "bg-gray-50"}`}
									>
										<Heart size={20} className={`mx-auto mb-2 ${muted}`} />
										<p className={`text-xs ${muted}`}>
											{t("settings_modal.interests_tab.empty")
												.split("\n")
												.map((line, index) => (
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
													<span className="text-sm truncate">
														{item.keyword}
													</span>
													<span
														className={`text-[10px] flex-shrink-0 ${muted}`}
													>
														{typeof item.score === "number"
															? item.score.toFixed(1)
															: ""}
													</span>
												</div>
												<button
													onClick={() => removeKeywordInterest(item.keyword)}
													className={`p-1 rounded transition-colors flex-shrink-0 ${
														isDark
															? "hover:bg-red-500/20 text-white/40 hover:text-red-300"
															: "hover:bg-red-50 text-gray-400 hover:text-red-500"
													}`}
													aria-label={t("common.delete")}
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
												t("settings_modal.interests_tab.reset_title"),
												t("settings_modal.interests_tab.reset_message"),
												() => {
													resetKeywordInterests();
													closeConfirm();
												},
											)
										}
										className={`w-full p-2.5 rounded-xl text-sm text-left ${
											isDark
												? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
												: "bg-red-50 text-red-500 hover:bg-red-100"
										} transition-colors`}
									>
										{t("settings_modal.interests_tab.reset_button")}
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
