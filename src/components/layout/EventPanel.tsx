import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useDialog } from "../../hooks/useDialog";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, ChevronRight, Clock, RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useFontSize } from "../../hooks/useFontSize";
import {
	GOOGLE_SYNC_AUTH_ERROR,
	useGoogleCalendarStore,
	type CalendarEvent,
} from "../../store/useGoogleCalendarStore";
import { useAuthStore } from "../../store/useAuthStore";
import {
	buildRepeatObject,
	getRepeatOptions,
	getWeekDaysShort,
} from "../../utils/eventRepeat";
import ConfirmDialog from "../common/ConfirmDialog";
import EventDetail from "./event/EventDetail";
import EventForm from "./event/EventForm";
import {
	EMPTY_DESCRIPTION_FORMAT_STATE,
	escapeDescriptionAttribute,
	escapeDescriptionHtml,
	getEventDescriptionEditorHtml,
	isHtmlDescription,
	normalizeDescriptionLinkUrl,
	normalizeEventDescriptionValue,
	sanitizeEventDescriptionHtml,
} from "./event/eventDescription";
import {
	formatEventTimeLabel,
	formDataFromEvent,
	getDisplayEventTitle,
	getEmptyForm,
	parseGuestEmailsText,
	type CalendarEventDetail,
} from "./event/eventFormData";

interface EventPanelProps {
	selectedDate: string | null;
	onClose: () => void;
}

const EventPanel = ({ selectedDate, onClose }: EventPanelProps) => {
	const { t, i18n } = useTranslation();
	const { isDark, cardCls, hoverCls, secondaryBgCls } = useTheme();
	const { body: bodyStyle } = useFontSize();
	const { events, loading, error, addEvent, deleteEvent, updateEvent, readEvent } =
		useGoogleCalendarStore(
			useShallow((s) => ({
				events: s.events,
				loading: s.loading,
				error: s.error,
				addEvent: s.addEvent,
				deleteEvent: s.deleteEvent,
				updateEvent: s.updateEvent,
				readEvent: s.readEvent,
			})),
		);
	const reconnectGoogle = useAuthStore((s) => s.reconnectGoogle);
	const modalCardCls = isDark
		? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
		: "bg-morning-light-card border-morning-light-hover/50 text-morning-light-text";
	const modalSecondaryBtnCls = isDark
		? "bg-morning-dark-cardSecondary hover:bg-morning-dark-hover text-morning-dark-text"
		: "bg-morning-light-cardSecondary hover:bg-morning-light-hover/70 text-morning-light-text";
	const [showAddForm, setShowAddForm] = useState(false);
	const [selectedEventForDetail, setSelectedEventForDetail] = useState<CalendarEventDetail | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingEventDate, setEditingEventDate] = useState("");
	const [editingEventSnapshot, setEditingEventSnapshot] = useState<CalendarEvent | null>(null);
	const [formData, setFormData] = useState(getEmptyForm);
	const [copiedMeetLink, setCopiedMeetLink] = useState("");
	const [isReconnecting, setIsReconnecting] = useState(false);
	const [isResolvingSeries, setIsResolvingSeries] = useState(false);
	const [isDescriptionEditorFocused, setIsDescriptionEditorFocused] = useState(false);
	const [showDescriptionLinkInput, setShowDescriptionLinkInput] = useState(false);
	const [descriptionLinkValue, setDescriptionLinkValue] = useState("");
	const [descriptionFormatState, setDescriptionFormatState] = useState(
		EMPTY_DESCRIPTION_FORMAT_STATE,
	);
	const descriptionEditorRef = useRef<HTMLDivElement>(null);
	const savedDescriptionRangeRef = useRef<Range | null>(null);

	const selectedEvents = (events || []).filter((event) => event.date === selectedDate);
	const showReconnectGoogle = error === GOOGLE_SYNC_AUTH_ERROR;
	const activeFormDate = editingEventDate || selectedDate || "";
	const repeatOptions = getRepeatOptions(activeFormDate, i18n.language);
	const weekDaysShort = getWeekDaysShort(i18n.language);
	const noTitleLabel = t("common.no_title");
	const visibilityOptions = [
		{ value: "default", label: t("common.default") },
		{ value: "private", label: t("common.private") },
		{ value: "public", label: t("common.public") },
	];
	const availabilityOptions = [
		{ value: "busy", label: t("common.busy") },
		{ value: "free", label: t("common.free") },
	];
	const reminderModeOptions = [
		{ value: "default", label: t("events.calendar_default") },
		{ value: "none", label: t("events.no_reminder") },
		{ value: "custom", label: t("events.custom_reminder") },
	];
	const reminderMinuteOptions = [10, 30, 60, 1440];
	const customFrequencyOptions = [
		{ value: "daily", label: t("events.freq_day", { count: Number(formData.customInterval) }) },
		{ value: "weekly", label: t("events.freq_week", { count: Number(formData.customInterval) }) },
		{ value: "monthly", label: t("events.freq_month", { count: Number(formData.customInterval) }) },
		{ value: "yearly", label: t("events.freq_year", { count: Number(formData.customInterval) }) },
	];
	const selectedEventDescription = String(selectedEventForDetail?.description || "");
	const selectedEventDescriptionHtml = isHtmlDescription(selectedEventDescription)
		? sanitizeEventDescriptionHtml(selectedEventDescription)
		: "";

	const resetForm = () => {
		setFormData(getEmptyForm());
		setEditingId(null);
		setEditingEventDate("");
		setEditingEventSnapshot(null);
		setIsDescriptionEditorFocused(false);
		setShowDescriptionLinkInput(false);
		setDescriptionLinkValue("");
		setDescriptionFormatState(EMPTY_DESCRIPTION_FORMAT_STATE);
		savedDescriptionRangeRef.current = null;
	};

	const handleCloseAddForm = () => {
		setShowAddForm(false);
		resetForm();
	};

	const { ref: addFormDialogRef, dialogProps: addFormDialogProps } = useDialog<HTMLDivElement>({
		open: showAddForm,
		onClose: handleCloseAddForm,
		labelledBy: "event-form-title",
	});
	const { ref: detailDialogRef, dialogProps: detailDialogProps } = useDialog<HTMLDivElement>({
		open: !!selectedEventForDetail,
		onClose: () => setSelectedEventForDetail(null),
		labelledBy: "event-detail-title",
	});

	useEffect(() => {
		setShowAddForm(false);
		setSelectedEventForDetail(null);
		resetForm();
		setCopiedMeetLink("");
	}, [selectedDate]);

	useEffect(() => {
		if (
			!showAddForm ||
			!descriptionEditorRef.current ||
			isDescriptionEditorFocused
		) {
			return;
		}

		const nextHtml = getEventDescriptionEditorHtml(formData.description);
		if (descriptionEditorRef.current.innerHTML !== nextHtml) {
			descriptionEditorRef.current.innerHTML = nextHtml;
		}
	}, [showAddForm, editingId, formData.description, isDescriptionEditorFocused]);

	useEffect(() => {
		if (!showAddForm || typeof document === "undefined") return undefined;

		const handleSelectionChange = () => {
			updateDescriptionFormatState();
		};

		document.addEventListener("selectionchange", handleSelectionChange);
		return () => {
			document.removeEventListener("selectionchange", handleSelectionChange);
		};
	}, [showAddForm, showDescriptionLinkInput]);

	const handleReconnectGoogle = async () => {
		setIsReconnecting(true);
		try {
			await reconnectGoogle();
			setIsReconnecting(false);
		} catch (err) {
			console.error("Failed to reconnect Google:", err);
			setIsReconnecting(false);
		}
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!formData.allDay && (!formData.startTime || !formData.endTime)) {
			toast.error(t("toast.event_time_required"), { id: "event-time-required" });
			return;
		}

		const isEdit = !!editingId;
		const targetId = editingId;
		const previousDetail = selectedEventForDetail;
		const attendees = parseGuestEmailsText(formData.guestEmailsText);
		const repeat = buildRepeatObject(formData);
		const existingEvent = isEdit
			? editingEventSnapshot || events.find((item) => item.id === targetId)
			: null;
		const payload = {
			title: formData.title,
			allDay: formData.allDay,
			date: activeFormDate,
			location: formData.location,
			description: formData.description,
			startTime: formData.allDay ? "" : formData.startTime,
			endTime: formData.allDay ? "" : formData.endTime,
			repeat,
			attendees,
			addGoogleMeet: formData.addGoogleMeet,
			clearConference: !!(
				isEdit &&
				existingEvent?.addGoogleMeet &&
				!formData.addGoogleMeet
			),
			visibility: formData.visibility,
			availability: formData.availability,
			remindersUseDefault: formData.reminderMode === "default",
			reminderOverrides:
				formData.reminderMode === "custom"
					? [
							{
								method: "popup",
								minutes: Number(formData.reminderMinutes || 30),
							},
						]
					: [],
			sendUpdates: attendees.length > 0 ? formData.sendUpdates : false,
		};

		handleCloseAddForm();
		if (isEdit && previousDetail && previousDetail.id === targetId) {
			setSelectedEventForDetail({ ...previousDetail, ...payload } as unknown as CalendarEventDetail);
		}

		try {
			if (isEdit && targetId) {
				await updateEvent(targetId, payload);
			} else if (!isEdit) {
				await addEvent(payload);
			}
		} catch (err) {
			console.error("[gcal] save event failed:", err);
			const errMessage = (err as { message?: string })?.message === GOOGLE_SYNC_AUTH_ERROR
				? t("gsync.auth_expired")
				: (err as { message?: string })?.message;
			toast.error(
				errMessage
					? `${t("toast.event_save_failed")}: ${errMessage}`
					: t("toast.event_save_failed"),
				{ id: "event-save-failed" },
			);
		}
	};

	const handleDelete = (eventId: string | undefined) => {
		if (eventId) setConfirmDelete(eventId);
	};

	const handleConfirmDelete = async () => {
		if (!confirmDelete) return;
		try {
			await deleteEvent(confirmDelete);
			setSelectedEventForDetail(null);
		} catch (err) {
			console.error("Failed to delete event:", err);
		} finally {
			setConfirmDelete(null);
		}
	};

	const resolveSeriesEvent = async (event: CalendarEvent): Promise<CalendarEventDetail> => {
		const seriesId = event?.seriesEventId || event?.recurringEventId || event?.id;
		if (!seriesId || seriesId === event?.id) return event;

		const masterEvent = await readEvent(seriesId).catch(() => null);
		if (!masterEvent) return event;

		return {
			...masterEvent,
			seriesEventId: masterEvent.id ?? null,
			seriesStartDate: masterEvent.date,
		};
	};

	const openEventDetail = async (event: CalendarEventDetail) => {
		setSelectedEventForDetail(event);
		if (!event?.recurringEventId) return;

		setIsResolvingSeries(true);
		try {
			const masterEvent = await resolveSeriesEvent(event);
			setSelectedEventForDetail((current) =>
				current?.id === event.id
					? {
						...current,
						repeat: masterEvent?.repeat || current?.repeat || null,
						seriesEventId: masterEvent?.id ?? current?.seriesEventId ?? current?.recurringEventId ?? null,
						seriesStartDate: masterEvent?.date || current?.seriesStartDate || current?.date,
					} as CalendarEventDetail
					: current,
			);
		} finally {
			setIsResolvingSeries(false);
		}
	};

	const handleEditFromDetail = async (event: CalendarEventDetail) => {
		const sourceEvent = await resolveSeriesEvent(event);
		setFormData(formDataFromEvent(sourceEvent));
		setEditingId(sourceEvent.id ?? null);
		setEditingEventDate(sourceEvent.date || (selectedDate ?? ""));
		setEditingEventSnapshot(sourceEvent);
		setShowAddForm(true);
		setSelectedEventForDetail(null);
	};

	const toggleCustomDay = (code: string) => {
		setFormData((prev) => ({
			...prev,
			customDays: prev.customDays.includes(code)
				? prev.customDays.filter((dayCode) => dayCode !== code)
				: [...prev.customDays, code],
		}));
	};

	const handleCopyMeetLink = async (url: unknown) => {
		const text = String(url || "").trim();
		if (!text) return;

		try {
			await navigator.clipboard.writeText(text);
			setCopiedMeetLink(text);
			window.setTimeout(() => {
				setCopiedMeetLink((current) => (current === text ? "" : current));
			}, 1800);
		} catch (error) {
			console.error("Failed to copy meet link:", error);
		}
	};

	const syncDescriptionFromEditor = () => {
		const editor = descriptionEditorRef.current;
		if (!editor) return;
		const nextDescription = normalizeEventDescriptionValue(editor.innerHTML);
		setFormData((prev) =>
			prev.description === nextDescription
				? prev
				: {
						...prev,
						description: nextDescription,
					},
		);
	};

	const saveDescriptionSelection = () => {
		if (
			typeof window === "undefined" ||
			!descriptionEditorRef.current ||
			typeof window.getSelection !== "function"
		) {
			return;
		}

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;
		const range = selection.getRangeAt(0);
		if (!descriptionEditorRef.current.contains(range.commonAncestorContainer)) return;
		savedDescriptionRangeRef.current = range.cloneRange();
	};

	const restoreDescriptionSelection = () => {
		if (
			typeof window === "undefined" ||
			typeof window.getSelection !== "function" ||
			!savedDescriptionRangeRef.current
		) {
			return false;
		}

		const selection = window.getSelection();
		if (!selection) return false;
		selection.removeAllRanges();
		selection.addRange(savedDescriptionRangeRef.current);
		return true;
	};

	const updateDescriptionFormatState = () => {
		if (
			typeof document === "undefined" ||
			typeof window === "undefined" ||
			typeof window.getSelection !== "function" ||
			typeof document.queryCommandState !== "function" ||
			!descriptionEditorRef.current
		) {
			setDescriptionFormatState(EMPTY_DESCRIPTION_FORMAT_STATE);
			return;
		}

		const safeQueryCommandState = (command: string) => {
			try {
				return document.queryCommandState(command);
			} catch {
				return false;
			}
		};

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) {
			setDescriptionFormatState(EMPTY_DESCRIPTION_FORMAT_STATE);
			return;
		}

		const range = selection.getRangeAt(0);
		if (!descriptionEditorRef.current.contains(range.commonAncestorContainer)) {
			setDescriptionFormatState(EMPTY_DESCRIPTION_FORMAT_STATE);
			return;
		}

		const resolveAnchor = (node: Node | null): Element | null => {
			if (!node) return null;
			if (node.nodeType === Node.ELEMENT_NODE) {
				return (node as Element).closest?.("a") || null;
			}
			return (node as ChildNode).parentElement?.closest?.("a") || null;
		};

		const activeLink =
			resolveAnchor(selection.anchorNode) ||
			resolveAnchor(selection.focusNode) ||
			resolveAnchor(range.commonAncestorContainer);

		setDescriptionFormatState({
			bold: safeQueryCommandState("bold"),
			italic: safeQueryCommandState("italic"),
			underline: safeQueryCommandState("underline"),
			orderedList: safeQueryCommandState("insertOrderedList"),
			unorderedList: safeQueryCommandState("insertUnorderedList"),
			link: !!activeLink,
			strikeThrough: safeQueryCommandState("strikeThrough"),
		});
	};

	const applyDescriptionFormat = (command: string, value: string | null = null) => {
		if (
			typeof document === "undefined" ||
			typeof document.execCommand !== "function" ||
			!descriptionEditorRef.current
		) {
			return;
		}

		restoreDescriptionSelection();
		descriptionEditorRef.current.focus();
		document.execCommand("styleWithCSS", false, undefined);
		document.execCommand(command, false, value ?? undefined);
		syncDescriptionFromEditor();
		saveDescriptionSelection();
		updateDescriptionFormatState();
	};

	const handleDescriptionToolbarMouseDown = (event: React.MouseEvent, callback: () => void) => {
		event.preventDefault();
		saveDescriptionSelection();
		callback();
	};

	const handleApplyDescriptionLink = () => {
		const normalizedUrl = normalizeDescriptionLinkUrl(descriptionLinkValue);
		if (!normalizedUrl || !descriptionEditorRef.current) return;

		restoreDescriptionSelection();
		descriptionEditorRef.current.focus();
		const selectedText =
			typeof window !== "undefined" && typeof window.getSelection === "function"
				? String(window.getSelection()?.toString() || "").trim()
				: "";

		if (selectedText) {
			applyDescriptionFormat("createLink", normalizedUrl);
		} else if (typeof document !== "undefined") {
			document.execCommand(
				"insertHTML",
				false,
				`<a href="${escapeDescriptionAttribute(normalizedUrl)}">${escapeDescriptionHtml(normalizedUrl)}</a>`,
			);
			syncDescriptionFromEditor();
			saveDescriptionSelection();
			updateDescriptionFormatState();
		}

		setShowDescriptionLinkInput(false);
		setDescriptionLinkValue("");
	};

	const getDescriptionToolbarButtonCls = (isActive: boolean) =>
		`inline-flex h-9 w-9 items-center justify-center transition-colors ${
			isActive
				? isDark
					? "bg-morning-dark-hover text-white"
					: "bg-morning-light-hover/90 text-gray-900"
				: isDark
					? "text-gray-200 hover:bg-morning-dark-hover"
					: "text-gray-700 hover:bg-morning-light-hover/60"
		}`;

	return (
		<div className={`rounded-xl border p-4 space-y-4 h-auto ${cardCls}`}>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Clock size={16} className="text-orange-500" />
					<h3 className="font-bold text-sm">{t("events.title")}</h3>
				</div>
				<button
					aria-label={t("events.add_event")}
					onClick={() => {
						const nextOpen = !showAddForm;
						setShowAddForm(nextOpen);
						setSelectedEventForDetail(null);
						if (!nextOpen) {
							resetForm();
						} else if (!editingId) {
							setFormData(getEmptyForm());
						}
					}}
					className={`p-1.5 rounded-lg transition-colors ${hoverCls}`}
				>
					<Plus size={16} />
				</button>
			</div>

			{loading && (
				<div className="flex items-center justify-center py-6">
					<div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
				</div>
			)}

			{error && !loading && (
				<div
					className={`p-3 rounded-lg text-xs space-y-2 ${isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"}`}
				>
					<p>{showReconnectGoogle ? t("gsync.auth_expired") : error}</p>
					{showReconnectGoogle && (
						<button
							type="button"
							onClick={handleReconnectGoogle}
							disabled={isReconnecting}
							className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
								isDark
									? "bg-white/10 text-white hover:bg-white/15"
									: "bg-white text-red-700 hover:bg-red-100"
							}`}
						>
							<RefreshCw
								size={12}
								className={isReconnecting ? "animate-spin" : ""}
							/>
							{isReconnecting
								? t("common.reconnecting")
								: t("common.reconnect_google")}
						</button>
					)}
				</div>
			)}

			{showAddForm &&
				typeof document !== "undefined" &&
				createPortal(
					<EventForm
						modalCardCls={modalCardCls}
						modalSecondaryBtnCls={modalSecondaryBtnCls}
						addFormDialogRef={addFormDialogRef}
						addFormDialogProps={addFormDialogProps}
						handleCloseAddForm={handleCloseAddForm}
						handleSubmit={handleSubmit}
						editingId={editingId}
						activeFormDate={activeFormDate}
						formData={formData}
						setFormData={setFormData}
						repeatOptions={repeatOptions}
						weekDaysShort={weekDaysShort}
						customFrequencyOptions={customFrequencyOptions}
						visibilityOptions={visibilityOptions}
						availabilityOptions={availabilityOptions}
						reminderModeOptions={reminderModeOptions}
						reminderMinuteOptions={reminderMinuteOptions}
						toggleCustomDay={toggleCustomDay}
						descriptionEditorRef={descriptionEditorRef}
						isDescriptionEditorFocused={isDescriptionEditorFocused}
						setIsDescriptionEditorFocused={setIsDescriptionEditorFocused}
						showDescriptionLinkInput={showDescriptionLinkInput}
						setShowDescriptionLinkInput={setShowDescriptionLinkInput}
						descriptionLinkValue={descriptionLinkValue}
						setDescriptionLinkValue={setDescriptionLinkValue}
						descriptionFormatState={descriptionFormatState}
						setDescriptionFormatState={setDescriptionFormatState}
						syncDescriptionFromEditor={syncDescriptionFromEditor}
						saveDescriptionSelection={saveDescriptionSelection}
						updateDescriptionFormatState={updateDescriptionFormatState}
						applyDescriptionFormat={applyDescriptionFormat}
						handleDescriptionToolbarMouseDown={handleDescriptionToolbarMouseDown}
						handleApplyDescriptionLink={handleApplyDescriptionLink}
						getDescriptionToolbarButtonCls={getDescriptionToolbarButtonCls}
					/>,
					document.body,
				)}

			<div className="space-y-2 max-h-[300px] overflow-y-auto">
				{selectedEvents.length > 0 ? (
					selectedEvents.map((event) => (
						<div
							key={event.id}
							onClick={() => openEventDetail(event)}
							className={`p-2 rounded-lg border-l-4 border-orange-500 cursor-pointer transition-colors hover:opacity-80 ${secondaryBgCls} ${hoverCls}`}
						>
							<div className="flex items-center justify-between gap-2">
								<div className="flex-1 min-w-0">
									<h4 className="font-semibold text-xs truncate" style={bodyStyle}>
										{getDisplayEventTitle(event, noTitleLabel)}
									</h4>
									{(event.allDay || event.startTime || event.endTime) && (
										<p
											className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
											style={bodyStyle}
										>
											{formatEventTimeLabel(event, i18n.language)}
										</p>
									)}
								</div>
								<ChevronRight size={16} className="flex-shrink-0 opacity-50" />
							</div>
						</div>
					))
				) : !loading && !error ? (
					<div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500 font-medium">
						{t("events.no_events")}
					</div>
				) : null}
			</div>

			{selectedEventForDetail &&
				typeof document !== "undefined" &&
				createPortal(
					<EventDetail
						modalCardCls={modalCardCls}
						detailDialogRef={detailDialogRef}
						detailDialogProps={detailDialogProps}
						selectedEventForDetail={selectedEventForDetail}
						setSelectedEventForDetail={setSelectedEventForDetail}
						noTitleLabel={noTitleLabel}
						visibilityOptions={visibilityOptions}
						availabilityOptions={availabilityOptions}
						isResolvingSeries={isResolvingSeries}
						selectedEventDescription={selectedEventDescription}
						selectedEventDescriptionHtml={selectedEventDescriptionHtml}
						copiedMeetLink={copiedMeetLink}
						handleCopyMeetLink={handleCopyMeetLink}
						handleEditFromDetail={handleEditFromDetail}
						handleDelete={handleDelete}
					/>,
					document.body,
				)}

			{confirmDelete && (
				<ConfirmDialog
					title={t("events.delete_event")}
					message={t("events.delete_event_confirm")}
					confirmLabel={t("common.delete")}
					cancelLabel={t("common.cancel")}
					onConfirm={handleConfirmDelete}
					onCancel={() => setConfirmDelete(null)}
				/>
			)}
		</div>
	);
};

export default EventPanel;
