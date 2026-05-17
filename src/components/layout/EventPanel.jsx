import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
	Bold,
	Italic,
	Plus,
	X,
	Trash2,
	MapPin,
	Edit2,
	Clock,
	ChevronRight,
	Copy,
	Check,
	RefreshCw,
	Users,
	Video,
	Bell,
	Eye,
	Link2,
	List,
	ListOrdered,
	Repeat,
	Strikethrough,
	Underline,
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import {
	GOOGLE_SYNC_AUTH_ERROR,
	useGoogleCalendarStore,
} from "../../store/useGoogleCalendarStore";
import { useAuthStore } from "../../store/useAuthStore";
import {
	buildRepeatObject,
	formDataFromRepeat,
	getRepeatLabel,
	getRepeatOptions,
	getWeekDaysShort,
} from "../../utils/eventRepeat";
import ConfirmDialog from "../common/ConfirmDialog";
import GooglePlacesLocationField from "../common/GooglePlacesLocationField";
import TimeInput from "../common/TimeInput";

const EMPTY_FORM = {
	title: "",
	allDay: false,
	startTime: "",
	endTime: "",
	description: "",
	location: "",
	guestEmailsText: "",
	addGoogleMeet: false,
	visibility: "default",
	availability: "busy",
	reminderMode: "default",
	reminderMinutes: "30",
	sendUpdates: true,
	...formDataFromRepeat(null),
};

const getRoundedDefaultEventStartTime = (baseDate = new Date()) => {
	const rounded = new Date(baseDate);
	rounded.setSeconds(0, 0);
	const roundedMinutes = Math.ceil(rounded.getMinutes() / 30) * 30;
	if (roundedMinutes === 60) {
		rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
	} else {
		rounded.setMinutes(roundedMinutes, 0, 0);
	}
	return `${String(rounded.getHours()).padStart(2, "0")}:${String(
		rounded.getMinutes(),
	).padStart(2, "0")}`;
};

const getDefaultEventEndTime = (startTime) => {
	if (!startTime) return "";
	const [hoursRaw, minutesRaw] = String(startTime).split(":");
	const hours = Number(hoursRaw);
	const minutes = Number(minutesRaw || 0);
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
	const end = new Date();
	end.setHours(hours, minutes, 0, 0);
	end.setMinutes(end.getMinutes() + 60);
	return `${String(end.getHours()).padStart(2, "0")}:${String(
		end.getMinutes(),
	).padStart(2, "0")}`;
};

const getEmptyForm = () => {
	const startTime = getRoundedDefaultEventStartTime();
	return {
		...EMPTY_FORM,
		startTime,
		endTime: getDefaultEventEndTime(startTime),
	};
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;
const ALLOWED_EVENT_DESCRIPTION_TAGS = new Set([
	"A",
	"B",
	"STRONG",
	"I",
	"EM",
	"U",
	"S",
	"STRIKE",
	"P",
	"BR",
	"UL",
	"OL",
	"LI",
	"DIV",
	"SPAN",
	"BLOCKQUOTE",
	"PRE",
	"CODE",
]);
const ALLOWED_EVENT_DESCRIPTION_PROTOCOLS = new Set([
	"http:",
	"https:",
	"mailto:",
	"tel:",
]);

const isHtmlDescription = (value) => HTML_TAG_PATTERN.test(String(value || ""));

const escapeDescriptionHtml = (value) =>
	String(value || "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

const escapeDescriptionAttribute = (value) =>
	String(value || "")
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

const normalizeDescriptionLinkUrl = (value) => {
	const raw = String(value || "").trim();
	if (!raw) return "";
	const normalized = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw) ? raw : `https://${raw}`;

	try {
		const resolved = new URL(normalized);
		if (!ALLOWED_EVENT_DESCRIPTION_PROTOCOLS.has(resolved.protocol)) return "";
		return resolved.toString();
	} catch {
		return "";
	}
};

const EMPTY_DESCRIPTION_FORMAT_STATE = {
	bold: false,
	italic: false,
	underline: false,
	orderedList: false,
	unorderedList: false,
	link: false,
	strikeThrough: false,
};

const getEventDescriptionEditorHtml = (value) => {
	const raw = String(value || "");
	if (!raw.trim()) return "";
	if (isHtmlDescription(raw)) {
		return sanitizeEventDescriptionHtml(raw);
	}
	return escapeDescriptionHtml(raw).replaceAll("\n", "<br>");
};

const normalizeEventDescriptionValue = (rawHtml) => {
	const html = String(rawHtml || "").trim();
	if (!html) return "";
	if (typeof document === "undefined" || typeof DOMParser === "undefined") {
		return html;
	}

	const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
	const text = String(parsed.body.textContent || "")
		.replaceAll("\u00a0", " ")
		.trim();
	return text ? html : "";
};

const sanitizeEventDescriptionHtml = (rawHtml) => {
	if (!rawHtml || typeof document === "undefined" || typeof DOMParser === "undefined") {
		return String(rawHtml || "");
	}

	const parser = new DOMParser();
	const parsed = parser.parseFromString(`<div>${String(rawHtml)}</div>`, "text/html");

	const sanitizeNode = (node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			return document.createTextNode(node.textContent || "");
		}

		if (node.nodeType !== Node.ELEMENT_NODE) {
			return document.createDocumentFragment();
		}

		const tagName = node.tagName.toUpperCase();
		const cleanChildren = (target) => {
			Array.from(node.childNodes).forEach((child) => {
				target.appendChild(sanitizeNode(child));
			});
			return target;
		};

		if (!ALLOWED_EVENT_DESCRIPTION_TAGS.has(tagName)) {
			return cleanChildren(document.createDocumentFragment());
		}

		if (tagName === "A") {
			const href = String(node.getAttribute("href") || "").trim();
			if (!href) {
				return cleanChildren(document.createDocumentFragment());
			}

			try {
				const resolved = new URL(href, window.location.origin);
				if (!ALLOWED_EVENT_DESCRIPTION_PROTOCOLS.has(resolved.protocol)) {
					return cleanChildren(document.createDocumentFragment());
				}

				const anchor = document.createElement("a");
				anchor.setAttribute("href", resolved.toString());
				anchor.setAttribute("target", "_blank");
				anchor.setAttribute("rel", "noreferrer noopener");
				return cleanChildren(anchor);
			} catch {
				return cleanChildren(document.createDocumentFragment());
			}
		}

		return cleanChildren(document.createElement(tagName.toLowerCase()));
	};

	const wrapper = document.createElement("div");
	Array.from(parsed.body.childNodes).forEach((child) => {
		wrapper.appendChild(sanitizeNode(child));
	});
	return wrapper.innerHTML;
};

const parseGuestEmailsText = (rawText) =>
	Array.from(
		new Set(
			String(rawText || "")
				.split(/[\n,;]/)
				.map((entry) => entry.trim())
				.filter((entry) => EMAIL_PATTERN.test(entry)),
		),
	).map((email) => ({ email }));

const formatReminderMinutes = (minutes, language = "en") => {
	const value = Number(minutes || 0);
	if (!Number.isFinite(value) || value <= 0) {
		return language === "ko" ? "사용자 지정 알림" : "Custom reminder";
	}
	if (value === 1440) return language === "ko" ? "1일 전" : "1 day before";
	if (value % 60 === 0) {
		const hours = value / 60;
		return language === "ko"
			? `${hours}시간 전`
			: `${hours} hour${hours === 1 ? "" : "s"} before`;
	}
	return language === "ko" ? `${value}분 전` : `${value} min before`;
};

const getReminderFormState = (event) => {
	if (event?.remindersUseDefault !== false) {
		return {
			reminderMode: "default",
			reminderMinutes: "30",
		};
	}

	const firstOverride = Array.isArray(event?.reminderOverrides)
		? event.reminderOverrides[0]
		: null;

	if (!firstOverride) {
		return {
			reminderMode: "none",
			reminderMinutes: "30",
		};
	}

	return {
		reminderMode: "custom",
		reminderMinutes: String(firstOverride.minutes || 30),
	};
};

const formatReminderLabel = (event, language = "en") => {
	if (event?.remindersUseDefault !== false) {
		return language === "ko" ? "캘린더 기본값" : "Calendar default";
	}
	if (!Array.isArray(event?.reminderOverrides) || event.reminderOverrides.length === 0) {
		return language === "ko" ? "알림 없음" : "No reminder";
	}
	return formatReminderMinutes(event.reminderOverrides[0].minutes, language);
};

const getLocaleTag = (language) => (language === "ko" ? "ko-KR" : "en-US");

const formatTimeLabel = (timeStr, language = "en") => {
	if (!timeStr) return "";
	const [hoursRaw, minutesRaw] = String(timeStr).split(":");
	const hours = Number(hoursRaw);
	if (Number.isNaN(hours)) return timeStr;
	const minutes = Number(minutesRaw || 0);
	if (Number.isNaN(minutes)) return timeStr;
	const date = new Date();
	date.setHours(hours, minutes, 0, 0);
	return date.toLocaleTimeString(getLocaleTag(language), {
		hour: "numeric",
		minute: "2-digit",
	});
};

const formatEventTimeLabel = (event, language = "en") => {
	if (event?.allDay) return language === "ko" ? "하루 종일" : "All day";
	if (event?.startTime && event?.endTime) {
		return `${formatTimeLabel(event.startTime, language)} - ${formatTimeLabel(
			event.endTime,
			language,
		)}`;
	}
	return formatTimeLabel(event?.startTime || event?.endTime || "", language);
};

const getDisplayEventTitle = (eventOrTitle, noTitleLabel = "(no title)") => {
	const rawTitle =
		typeof eventOrTitle === "string" ? eventOrTitle : eventOrTitle?.title;
	const title = String(rawTitle ?? "").trim();
	return title || noTitleLabel;
};

const formatMeetLinkLabel = (url) => {
	const normalized = String(url || "").trim();
	if (!normalized) return "";
	return normalized.replace(/^https?:\/\//i, "");
};

const formDataFromEvent = (event) => {
	const reminderState = getReminderFormState(event);
	return {
		title: event.title || "",
		allDay: !!event.allDay,
		startTime: event.startTime || "",
		endTime: event.endTime || "",
		description: event.description || "",
		location: event.location || "",
		guestEmailsText: (event.attendees || [])
			.map((attendee) => attendee.email)
			.filter(Boolean)
			.join(", "),
		addGoogleMeet: !!event.addGoogleMeet,
		visibility: event.visibility || "default",
		availability: event.availability || "busy",
		reminderMode: reminderState.reminderMode,
		reminderMinutes: reminderState.reminderMinutes,
		sendUpdates: event.sendUpdates ?? true,
		...formDataFromRepeat(event.repeat || null),
	};
};

const EventPanel = ({ selectedDate, onClose }) => {
	const { t, i18n } = useTranslation();
	const { isDark, cardCls, inputCls, hoverCls, secondaryBgCls } = useTheme();
	const { events, loading, error, addEvent, deleteEvent, updateEvent, readEvent } =
		useGoogleCalendarStore();
	const reconnectGoogle = useAuthStore((s) => s.reconnectGoogle);
	const modalCardCls = isDark
		? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
		: "bg-morning-light-card border-morning-light-hover/50 text-morning-light-text";
	const modalSecondaryBtnCls = isDark
		? "bg-morning-dark-cardSecondary hover:bg-morning-dark-hover text-morning-dark-text"
		: "bg-morning-light-cardSecondary hover:bg-morning-light-hover/70 text-morning-light-text";
	const [showAddForm, setShowAddForm] = useState(false);
	const [selectedEventForDetail, setSelectedEventForDetail] = useState(null);
	const [confirmDelete, setConfirmDelete] = useState(null);
	const [editingId, setEditingId] = useState(null);
	const [editingEventDate, setEditingEventDate] = useState("");
	const [editingEventSnapshot, setEditingEventSnapshot] = useState(null);
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
	const descriptionEditorRef = useRef(null);
	const savedDescriptionRangeRef = useRef(null);

	const selectedEvents = (events || []).filter((event) => event.date === selectedDate);
	const showReconnectGoogle = error === GOOGLE_SYNC_AUTH_ERROR;
	const activeFormDate = editingEventDate || selectedDate;
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
		{
			value: "daily",
			label:
				i18n.language === "ko"
					? "일"
					: `day${Number(formData.customInterval) !== 1 ? "s" : ""}`,
		},
		{
			value: "weekly",
			label:
				i18n.language === "ko"
					? "주"
					: `week${Number(formData.customInterval) !== 1 ? "s" : ""}`,
		},
		{
			value: "monthly",
			label:
				i18n.language === "ko"
					? "개월"
					: `month${Number(formData.customInterval) !== 1 ? "s" : ""}`,
		},
		{
			value: "yearly",
			label:
				i18n.language === "ko"
					? "년"
					: `year${Number(formData.customInterval) !== 1 ? "s" : ""}`,
		},
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

	const handleSubmit = async (event) => {
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
		if (isEdit && previousDetail?.id === targetId) {
			setSelectedEventForDetail({ ...previousDetail, ...payload });
		}

		try {
			if (isEdit) {
				await updateEvent(targetId, payload);
			} else {
				await addEvent(payload);
			}
		} catch (err) {
			console.error("[gcal] save event failed:", err);
			toast.error(
				err?.message
					? `${t("toast.event_save_failed")}: ${err.message}`
					: t("toast.event_save_failed"),
				{ id: "event-save-failed" },
			);
		}
	};

	const handleDelete = (eventId) => {
		setConfirmDelete(eventId);
	};

	const handleConfirmDelete = async () => {
		try {
			await deleteEvent(confirmDelete);
			setSelectedEventForDetail(null);
		} catch (err) {
			console.error("Failed to delete event:", err);
		} finally {
			setConfirmDelete(null);
		}
	};

	const resolveSeriesEvent = async (event) => {
		const seriesId = event?.seriesEventId || event?.recurringEventId || event?.id;
		if (!seriesId || seriesId === event?.id) return event;

		const masterEvent = await readEvent(seriesId).catch(() => null);
		if (!masterEvent) return event;

		return {
			...masterEvent,
			seriesEventId: masterEvent.id,
			seriesStartDate: masterEvent.date,
		};
	};

	const openEventDetail = async (event) => {
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
						seriesEventId: masterEvent?.id || current?.seriesEventId || current?.recurringEventId,
						seriesStartDate: masterEvent?.date || current?.seriesStartDate || current?.date,
					}
					: current,
			);
		} finally {
			setIsResolvingSeries(false);
		}
	};

	const handleEditFromDetail = async (event) => {
		const sourceEvent = await resolveSeriesEvent(event);
		setFormData(formDataFromEvent(sourceEvent));
		setEditingId(sourceEvent.id);
		setEditingEventDate(sourceEvent.date || selectedDate);
		setEditingEventSnapshot(sourceEvent);
		setShowAddForm(true);
		setSelectedEventForDetail(null);
	};

	const toggleCustomDay = (code) => {
		setFormData((prev) => ({
			...prev,
			customDays: prev.customDays.includes(code)
				? prev.customDays.filter((dayCode) => dayCode !== code)
				: [...prev.customDays, code],
		}));
	};

	const handleCopyMeetLink = async (url) => {
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

		const safeQueryCommandState = (command) => {
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

		const resolveAnchor = (node) => {
			if (!node) return null;
			if (node.nodeType === Node.ELEMENT_NODE) {
				return node.closest?.("a") || null;
			}
			return node.parentElement?.closest?.("a") || null;
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

	const applyDescriptionFormat = (command, value = null) => {
		if (
			typeof document === "undefined" ||
			typeof document.execCommand !== "function" ||
			!descriptionEditorRef.current
		) {
			return;
		}

		restoreDescriptionSelection();
		descriptionEditorRef.current.focus();
		document.execCommand("styleWithCSS", false, false);
		document.execCommand(command, false, value);
		syncDescriptionFromEditor();
		saveDescriptionSelection();
		updateDescriptionFormatState();
	};

	const handleDescriptionToolbarMouseDown = (event, callback) => {
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

	const getDescriptionToolbarButtonCls = (isActive) =>
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
					<p>{error}</p>
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
					<div
						className="fixed inset-0 z-[22000] bg-black/60 backdrop-blur-md flex items-center justify-center"
						onClick={handleCloseAddForm}
					>
						<div
							className={`z-[22010] w-full max-w-md max-h-[78vh] overflow-y-auto rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${modalCardCls}`}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								<h2 className="font-bold text-lg">
									{editingId ? t("events.edit_event") : t("events.add_event")}
								</h2>
								<button
									type="button"
									onClick={handleCloseAddForm}
									className={`p-1.5 rounded-lg ${hoverCls}`}
								>
									<X size={20} />
								</button>
							</div>

							<form onSubmit={handleSubmit} className="space-y-3 pr-1">
								<input
									type="text"
									placeholder={t("events.event_title_placeholder")}
									value={formData.title}
									onChange={(e) =>
										setFormData({ ...formData, title: e.target.value })
									}
									className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
									autoFocus
								/>

								<div className="space-y-1">
									<label
										className={`text-xs font-medium ${isDark ? "text-orange-400" : "text-orange-600"}`}
									>
										{t("common.date")}
									</label>
									<div
										className={`w-full rounded-lg border px-3 py-2 text-sm ${secondaryBgCls} ${isDark ? "border-morning-dark-hover text-gray-200" : "border-morning-light-hover/60 text-gray-700"}`}
									>
										{activeFormDate}
									</div>
								</div>

								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={formData.allDay}
										onChange={(e) =>
											setFormData((prev) => {
												const nextAllDay = e.target.checked;
												const defaults = getEmptyForm();
												return {
													...prev,
													allDay: nextAllDay,
													startTime: nextAllDay
														? ""
														: prev.startTime || defaults.startTime,
													endTime: nextAllDay
														? ""
														: prev.endTime || defaults.endTime,
												};
											})
										}
										className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
									/>
									<span>{t("common.all_day")}</span>
								</label>

								<div className="space-y-2">
									<div className="flex items-center justify-between gap-3">
										<label
											className={`text-xs font-medium ${isDark ? "text-orange-400" : "text-orange-600"}`}
										>
											{t("common.time")}
										</label>
									</div>

									{formData.allDay ? (
										<div
											className={`rounded-lg px-3 py-2 text-xs ${secondaryBgCls} ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											{t("events.all_day_saved")}
										</div>
									) : (
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<span
													className={`text-xs w-10 flex-shrink-0 ${isDark ? "text-gray-400" : "text-gray-600"}`}
												>
													{t("common.start")}
												</span>
												<TimeInput
													value={formData.startTime}
													onChange={(value) =>
														setFormData((prev) => ({
															...prev,
															startTime: value,
															endTime:
																prev.endTime && value && prev.endTime < value
																	? value
																	: prev.endTime,
														}))
													}
													required
													showFormatToggle={false}
													force12Hour
												/>
											</div>
											<div className="flex items-center gap-2">
												<span
													className={`text-xs w-10 flex-shrink-0 ${isDark ? "text-gray-400" : "text-gray-600"}`}
												>
													{t("common.end")}
												</span>
												<TimeInput
													value={formData.endTime}
													onChange={(value) =>
														setFormData({ ...formData, endTime: value })
													}
													required
													showFormatToggle={false}
													force12Hour
													minTime={formData.startTime}
												/>
											</div>
										</div>
									)}
								</div>

								<div className="space-y-1">
									<label
										className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-orange-400" : "text-orange-600"}`}
									>
										<Repeat size={12} />
										{t("common.repeat")}
									</label>
									<select
										value={formData.repeatType}
										onChange={(e) =>
											setFormData({ ...formData, repeatType: e.target.value })
										}
										className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
									>
										{repeatOptions.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</div>

								{formData.repeatType === "custom" && (
									<div
										className={`p-3 rounded-lg space-y-3 ${isDark ? "bg-morning-dark-cardSecondary" : "bg-morning-light-cardSecondary"}`}
									>
										<div className="flex items-center gap-2">
											<span
												className={`text-xs flex-shrink-0 ${isDark ? "text-gray-400" : "text-gray-600"}`}
											>
												{t("events.repeat_every")}
											</span>
											<input
												type="number"
												min="1"
												max="99"
												value={formData.customInterval}
												onChange={(e) =>
													setFormData({
														...formData,
														customInterval: e.target.value,
													})
												}
												className={`w-16 px-2 py-1.5 rounded-lg text-sm outline-none border text-center transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
											/>
											<select
												value={formData.customFreq}
												onChange={(e) =>
													setFormData({
														...formData,
														customFreq: e.target.value,
														customDays: [],
													})
												}
												className={`flex-1 px-2 py-1.5 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
											>
												{customFrequencyOptions.map((option) => (
													<option key={option.value} value={option.value}>
														{option.label}
													</option>
												))}
											</select>
										</div>

										{formData.customFreq === "weekly" && (
											<div>
												<p
													className={`text-xs mb-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}
												>
													{t("events.repeat_on")}
												</p>
												<div className="flex flex-wrap gap-1.5">
													{weekDaysShort.map(({ code, label }) => (
														<button
															key={code}
															type="button"
															onClick={() => toggleCustomDay(code)}
															className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
																formData.customDays.includes(code)
																	? "bg-orange-500 text-white"
																	: isDark
																		? "bg-morning-dark-hover text-gray-300 hover:bg-morning-dark-hover/70"
																		: "bg-morning-light-hover/40 text-gray-600 hover:bg-morning-light-hover/70"
															}`}
														>
															{label}
														</button>
													))}
												</div>
											</div>
										)}
									</div>
								)}

								<div className="space-y-1">
									<label
										className={`text-xs font-medium ${isDark ? "text-orange-400" : "text-orange-600"}`}
									>
										{t("common.location")}
									</label>
									<GooglePlacesLocationField
										value={formData.location}
										onChange={(nextLocation) =>
											setFormData({ ...formData, location: nextLocation })
										}
									/>
								</div>
								<div className="space-y-2">
									<label
										className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-orange-400" : "text-orange-600"}`}
									>
										<Users size={12} />
										{t("events.guests")}
									</label>
									<input
										type="text"
										placeholder={t("events.guest_emails_placeholder")}
										value={formData.guestEmailsText}
										onChange={(e) =>
											setFormData({
												...formData,
												guestEmailsText: e.target.value,
											})
										}
										className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
									/>
									{formData.guestEmailsText.trim() && (
										<label className="flex items-center gap-2 text-xs">
											<input
												type="checkbox"
												checked={formData.sendUpdates}
												onChange={(e) =>
													setFormData({
														...formData,
														sendUpdates: e.target.checked,
													})
												}
											className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
											/>
											<span>{t("events.send_invitation_emails")}</span>
										</label>
									)}
								</div>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={formData.addGoogleMeet}
										onChange={(e) =>
											setFormData({
												...formData,
												addGoogleMeet: e.target.checked,
											})
										}
										className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
									/>
									<span className="flex items-center gap-2">
										<Video size={14} />
										{t("events.add_google_meet_link")}
									</span>
								</label>
								<div className="space-y-1">
									<label
										className={`text-xs font-medium ${isDark ? "text-orange-400" : "text-orange-600"}`}
									>
										{t("common.description")}
									</label>
									<div className="space-y-2">
										<div
											className={`inline-flex items-center overflow-hidden rounded-lg border ${
												isDark
													? "border-morning-dark-hover bg-morning-dark-cardSecondary"
													: "border-morning-light-hover/70 bg-morning-light-cardSecondary"
											}`}
										>
											<button
												type="button"
												onMouseDown={(event) =>
													handleDescriptionToolbarMouseDown(event, () =>
														applyDescriptionFormat("bold"),
													)
												}
												className={getDescriptionToolbarButtonCls(
													descriptionFormatState.bold,
												)}
												title={t("events.toolbar.bold")}
											>
												<Bold size={16} />
											</button>
											<button
												type="button"
												onMouseDown={(event) =>
													handleDescriptionToolbarMouseDown(event, () =>
														applyDescriptionFormat("italic"),
													)
												}
												className={getDescriptionToolbarButtonCls(
													descriptionFormatState.italic,
												)}
												title={t("events.toolbar.italic")}
											>
												<Italic size={16} />
											</button>
											<button
												type="button"
												onMouseDown={(event) =>
													handleDescriptionToolbarMouseDown(event, () =>
														applyDescriptionFormat("underline"),
													)
												}
												className={getDescriptionToolbarButtonCls(
													descriptionFormatState.underline,
												)}
												title={t("events.toolbar.underline")}
											>
												<Underline size={16} />
											</button>
											<div
												className={`h-5 w-px ${
													isDark ? "bg-morning-dark-hover" : "bg-morning-light-hover/80"
												}`}
											/>
											<button
												type="button"
												onMouseDown={(event) =>
													handleDescriptionToolbarMouseDown(event, () =>
														applyDescriptionFormat("insertOrderedList"),
													)
												}
												className={getDescriptionToolbarButtonCls(
													descriptionFormatState.orderedList,
												)}
												title={t("events.toolbar.numbered_list")}
											>
												<ListOrdered size={16} />
											</button>
											<button
												type="button"
												onMouseDown={(event) =>
													handleDescriptionToolbarMouseDown(event, () =>
														applyDescriptionFormat("insertUnorderedList"),
													)
												}
												className={getDescriptionToolbarButtonCls(
													descriptionFormatState.unorderedList,
												)}
												title={t("events.toolbar.bullet_list")}
											>
												<List size={16} />
											</button>
											<div
												className={`h-5 w-px ${
													isDark ? "bg-morning-dark-hover" : "bg-morning-light-hover/80"
												}`}
											/>
											<button
												type="button"
												onMouseDown={(event) =>
													handleDescriptionToolbarMouseDown(event, () =>
														setShowDescriptionLinkInput(true),
													)
												}
												className={getDescriptionToolbarButtonCls(
													showDescriptionLinkInput || descriptionFormatState.link,
												)}
												title={t("events.toolbar.link")}
											>
												<Link2 size={16} />
											</button>
											<button
												type="button"
												onMouseDown={(event) =>
													handleDescriptionToolbarMouseDown(event, () =>
														applyDescriptionFormat("strikeThrough"),
													)
												}
												className={getDescriptionToolbarButtonCls(
													descriptionFormatState.strikeThrough,
												)}
												title={t("events.toolbar.strikethrough")}
											>
												<Strikethrough size={16} />
											</button>
										</div>
										{showDescriptionLinkInput && (
											<div className="flex items-center gap-2">
												<input
													type="text"
													value={descriptionLinkValue}
													onChange={(event) =>
														setDescriptionLinkValue(event.target.value)
													}
													placeholder={t("events.link_placeholder")}
													className={`flex-1 px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
													autoFocus
												/>
												<button
													type="button"
													onClick={handleApplyDescriptionLink}
													className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-orange-600"
												>
													{t("common.apply")}
												</button>
												<button
													type="button"
													onClick={() => {
														setShowDescriptionLinkInput(false);
														setDescriptionLinkValue("");
													}}
													className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${modalSecondaryBtnCls}`}
												>
													{t("common.cancel")}
												</button>
											</div>
										)}
										<div className="relative">
											{!formData.description && !isDescriptionEditorFocused && (
												<span
													className={`pointer-events-none absolute left-3 top-2 text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}
												>
													{t("events.description_placeholder")}
												</span>
											)}
											<div
												ref={descriptionEditorRef}
												contentEditable
												suppressContentEditableWarning
												onInput={() => {
													syncDescriptionFromEditor();
													saveDescriptionSelection();
													updateDescriptionFormatState();
												}}
												onFocus={() => {
													setIsDescriptionEditorFocused(true);
													saveDescriptionSelection();
													updateDescriptionFormatState();
												}}
												onMouseUp={() => {
													saveDescriptionSelection();
													updateDescriptionFormatState();
												}}
												onKeyUp={() => {
													saveDescriptionSelection();
													updateDescriptionFormatState();
												}}
												onBlur={() => {
													setIsDescriptionEditorFocused(false);
													syncDescriptionFromEditor();
													setDescriptionFormatState(EMPTY_DESCRIPTION_FORMAT_STATE);
												}}
												className={`min-h-[96px] w-full rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none transition-all focus:ring-2 focus:ring-orange-500/30 [&_a]:underline [&_a]:underline-offset-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 ${inputCls}`}
											/>
										</div>
									</div>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div className="space-y-1">
										<label
											className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-orange-400" : "text-orange-600"}`}
										>
											<Eye size={12} />
											{t("events.visibility")}
										</label>
										<select
											value={formData.visibility}
											onChange={(e) =>
												setFormData({ ...formData, visibility: e.target.value })
											}
											className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
										>
											{visibilityOptions.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</select>
									</div>
									<div className="space-y-1">
										<label
											className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-orange-400" : "text-orange-600"}`}
										>
											<Clock size={12} />
											{t("events.availability")}
										</label>
										<select
											value={formData.availability}
											onChange={(e) =>
												setFormData({
													...formData,
													availability: e.target.value,
												})
											}
											className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
										>
											{availabilityOptions.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</select>
									</div>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-[1.4fr,1fr] gap-3">
									<div className="space-y-1">
										<label
											className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-orange-400" : "text-orange-600"}`}
										>
											<Bell size={12} />
											{t("events.reminder")}
										</label>
										<select
											value={formData.reminderMode}
											onChange={(e) =>
												setFormData({
													...formData,
													reminderMode: e.target.value,
												})
											}
											className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
										>
											{reminderModeOptions.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</select>
									</div>
									<div className="space-y-1">
										<label
											className={`text-xs font-medium ${isDark ? "text-orange-400" : "text-orange-600"}`}
										>
											{t("events.when")}
										</label>
										<select
											value={formData.reminderMinutes}
											onChange={(e) =>
												setFormData({
													...formData,
													reminderMinutes: e.target.value,
												})
											}
											disabled={formData.reminderMode !== "custom"}
											className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 disabled:opacity-50 ${inputCls}`}
										>
											{reminderMinuteOptions.map((minutes) => (
												<option key={minutes} value={String(minutes)}>
													{formatReminderMinutes(minutes, i18n.language)}
												</option>
											))}
										</select>
									</div>
								</div>
								<div className="flex gap-2">
									<button
										type="submit"
										className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors"
									>
										{editingId ? t("common.save") : t("events.add_event")}
									</button>
									<button
										type="button"
										onClick={handleCloseAddForm}
										className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${modalSecondaryBtnCls}`}
									>
										{t("common.cancel")}
									</button>
								</div>
							</form>
						</div>
					</div>,
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
									<h4 className="font-semibold text-xs truncate">
										{getDisplayEventTitle(event, noTitleLabel)}
									</h4>
									{(event.allDay || event.startTime || event.endTime) && (
										<p
											className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
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
					<div
						className="fixed inset-0 z-[22000] bg-black/60 backdrop-blur-md flex items-center justify-center"
						onClick={() => setSelectedEventForDetail(null)}
					>
						<div
							className={`z-[22010] w-full max-w-md rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${modalCardCls}`}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								<h2 className="font-bold text-lg">
									{getDisplayEventTitle(selectedEventForDetail, noTitleLabel)}
								</h2>
								<button
									onClick={() => setSelectedEventForDetail(null)}
									className={`p-1.5 rounded-lg ${hoverCls}`}
								>
									<X size={20} />
								</button>
							</div>

							<div className="space-y-3 text-sm">
								{(selectedEventForDetail.allDay ||
									selectedEventForDetail.startTime ||
									selectedEventForDetail.endTime) && (
									<div>
										<p
											className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											{t("common.time")}
										</p>
										<p>{formatEventTimeLabel(selectedEventForDetail, i18n.language)}</p>
									</div>
								)}
								{selectedEventForDetail.repeat && (
									<div>
										<p
											className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											{t("common.repeat")}
										</p>
										<p>
											{getRepeatLabel(
												selectedEventForDetail.repeat,
												selectedEventForDetail.seriesStartDate ||
													selectedEventForDetail.date,
												i18n.language,
											)}
										</p>
									</div>
								)}
								{(selectedEventForDetail.recurringEventId ||
									selectedEventForDetail.seriesEventId) && (
									<p
										className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
									>
										{t("events.series_edit_notice")}
									</p>
								)}
								{isResolvingSeries &&
									selectedEventForDetail.recurringEventId &&
									!selectedEventForDetail.repeat && (
										<p
											className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											{t("events.loading_repeat_details")}
										</p>
									)}
								{selectedEventForDetail.location && (
									<div>
										<p
											className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											{t("common.location")}
										</p>
										<p className="flex items-center gap-2 min-w-0">
											<MapPin size={14} className="flex-shrink-0" />
											<span className="truncate">
												{selectedEventForDetail.location}
											</span>
										</p>
									</div>
								)}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div>
										<p
											className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											{t("events.visibility")}
										</p>
										<p className="capitalize">
											{visibilityOptions.find(
												(option) =>
													option.value ===
													(selectedEventForDetail.visibility || "default"),
											)?.label || t("common.default")}
										</p>
									</div>
									<div>
										<p
											className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											{t("events.availability")}
										</p>
										<p className="capitalize">
											{availabilityOptions.find(
												(option) =>
													option.value ===
													(selectedEventForDetail.availability || "busy"),
											)?.label || t("common.busy")}
										</p>
									</div>
								</div>
								<div>
										<p
											className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											{t("events.reminder")}
										</p>
									<p>{formatReminderLabel(selectedEventForDetail, i18n.language)}</p>
								</div>
								{Array.isArray(selectedEventForDetail.attendees) &&
									selectedEventForDetail.attendees.length > 0 && (
										<div>
											<p
												className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
											>
												{t("events.guests")}
											</p>
											<div className="space-y-1">
												{selectedEventForDetail.attendees.map((attendee) => (
													<p
														key={attendee.email}
														className="flex items-center gap-2"
													>
														<Users size={13} className="flex-shrink-0" />
														<span className="truncate">
															{attendee.displayName || attendee.email}
														</span>
													</p>
												))}
											</div>
										</div>
									)}
								{(selectedEventForDetail.meetLink ||
									selectedEventForDetail.conferenceStatus) && (
									<div>
										<p
											className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											{t("events.google_meet")}
										</p>
										{selectedEventForDetail.meetLink ? (
											<div className="space-y-1.5">
												<div className="flex items-start justify-between gap-3">
													<a
														href={selectedEventForDetail.meetLink}
														target="_blank"
														rel="noreferrer"
														className={isDark ? "text-blue-300 underline" : "text-blue-600 underline"}
													>
														{t("events.join_meeting")}
													</a>
													<button
														type="button"
														onClick={() =>
															handleCopyMeetLink(selectedEventForDetail.meetLink)
														}
														className={`rounded-md p-1 transition-colors ${hoverCls} ${isDark ? "text-gray-300" : "text-gray-600"}`}
														title={t("events.copy_meet_link")}
													>
														{copiedMeetLink === selectedEventForDetail.meetLink ? (
															<Check size={14} />
														) : (
															<Copy size={14} />
														)}
													</button>
												</div>
												<p
													className={`text-xs break-all ${isDark ? "text-gray-400" : "text-gray-600"}`}
												>
													{formatMeetLinkLabel(selectedEventForDetail.meetLink)}
												</p>
											</div>
										) : (
											<p className={isDark ? "text-gray-300" : "text-gray-700"}>
												{t("events.meet_link_preparing")}
											</p>
										)}
									</div>
								)}
								{selectedEventForDetail.description && (
									<div>
										<p
											className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											{t("common.description")}
										</p>
										{selectedEventDescriptionHtml ? (
											<div
												className={`text-sm leading-relaxed break-words [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 ${isDark ? "text-gray-300 [&_a]:text-blue-300 [&_blockquote]:border-white/20 [&_code]:bg-white/10 [&_pre]:bg-white/10" : "text-gray-700 [&_a]:text-blue-600 [&_blockquote]:border-black/10 [&_code]:bg-black/5 [&_pre]:bg-black/5"}`}
												dangerouslySetInnerHTML={{
													__html: selectedEventDescriptionHtml,
												}}
											/>
										) : (
											<p
												className={`whitespace-pre-wrap break-words ${isDark ? "text-gray-300" : "text-gray-700"}`}
											>
												{selectedEventDescription}
											</p>
										)}
									</div>
								)}
							</div>

							<div className="flex gap-2 pt-4 border-t">
								<button
									onClick={() => handleEditFromDetail(selectedEventForDetail)}
									className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${isDark ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400" : "bg-blue-100 hover:bg-blue-200 text-blue-600"}`}
								>
									<Edit2 size={14} /> {t("common.edit")}
								</button>
								<button
									onClick={() =>
										handleDelete(
											selectedEventForDetail.seriesEventId ||
												selectedEventForDetail.recurringEventId ||
												selectedEventForDetail.id,
										)
									}
									className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400"
								>
									<Trash2 size={14} /> {t("common.delete")}
								</button>
							</div>
						</div>
					</div>,
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
