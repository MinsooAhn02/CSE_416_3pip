import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
	Plus,
	X,
	Trash2,
	MapPin,
	Edit2,
	Clock,
	ChevronRight,
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useGoogleCalendarStore } from "../../store/useGoogleCalendarStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import ConfirmDialog from "../common/ConfirmDialog";
import TimeInput from "../common/TimeInput";

/**
 * EventPanel — Display and manage Google Calendar events for selected date
 *
 * PHASE 10 REFINEMENTS:
 * - Add form converted to Modal
 * - List items are compact previews (title + time only, no emojis)
 * - Detail modal shows full content and edit/delete actions
 * - Progressive disclosure pattern for better UX
 *
 * @param {{ selectedDate: string, onClose?: () => void }} props
 */
const EventPanel = ({ selectedDate, onClose }) => {
	const { isDark, cardCls, inputCls, hoverCls, secondaryBgCls } = useTheme();
	const { events, loading, error, addEvent, deleteEvent, updateEvent } =
		useGoogleCalendarStore();
	const is12Hour = useSettingsStore((s) => s.is12Hour);
	const setIs12Hour = useSettingsStore((s) => s.setIs12Hour);
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
	const [formData, setFormData] = useState({
		title: "",
		startTime: "",
		endTime: "",
		description: "",
		location: "",
	});

	const toggleTimeFormat = () => {
		setIs12Hour(!is12Hour);
	};

	/* REFINEMENT #5: Reset form state when selectedDate changes */
	useEffect(() => {
		setShowAddForm(false);
		setEditingId(null);
		setSelectedEventForDetail(null);
		setFormData({
			title: "",
			startTime: "",
			endTime: "",
			description: "",
			location: "",
		});
	}, [selectedDate]);

	/* Handle form submission for adding/updating event */
	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!formData.title.trim()) return;

		try {
			const data = {
				...formData,
				date: selectedDate,
			};

			if (editingId) {
				await updateEvent(editingId, data);
				setEditingId(null);
				if (selectedEventForDetail?.id === editingId) {
					setSelectedEventForDetail({ ...selectedEventForDetail, ...data });
				}
			} else {
				await addEvent(data);
			}

			// Reset form
			setFormData({
				title: "",
				startTime: "",
				endTime: "",
				description: "",
				location: "",
			});
			setShowAddForm(false);
		} catch (err) {
			console.error("Failed to save event:", err);
		}
	};

	/* Handle delete — open confirm dialog instead of native confirm() */
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

	/* Start editing an event from detail modal */
	const handleEditFromDetail = (event) => {
		setFormData({
			title: event.title || "",
			startTime: event.startTime || "",
			endTime: event.endTime || "",
			description: event.description || "",
			location: event.location || "",
		});
		setEditingId(event.id);
		setShowAddForm(true);
		setSelectedEventForDetail(null);
	};

	return (
		<div className={`rounded-xl border p-4 space-y-4 h-auto ${cardCls}`}>
			{/* Header */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Clock size={16} className="text-orange-500" />
					<h3 className="font-bold text-sm">Events</h3>
				</div>
				<button
					onClick={() => {
						setShowAddForm(!showAddForm);
						setEditingId(null);
						setSelectedEventForDetail(null);
						if (!showAddForm)
							setFormData({
								title: "",
								startTime: "",
								endTime: "",
								description: "",
								location: "",
							});
					}}
					className={`p-1.5 rounded-lg transition-colors ${hoverCls}`}
				>
					<Plus size={16} />
				</button>
			</div>

			{/* Loading State */}
			{loading && (
				<div className="flex items-center justify-center py-6">
					<div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
				</div>
			)}

			{/* Error State */}
			{error && !loading && (
				<div
					className={`p-3 rounded-lg text-xs ${isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"}`}
				>
					{error}
				</div>
			)}

			{/* PHASE 10: Add Form Modal */}
			{showAddForm &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						className="fixed inset-0 z-[22000] bg-black/60 backdrop-blur-md flex items-center justify-center"
						onClick={() => {
							setShowAddForm(false);
							setEditingId(null);
							setFormData({
								title: "",
								startTime: "",
								endTime: "",
								description: "",
								location: "",
							});
						}}
					>
						<div
							className={`z-[22010] w-full max-w-md rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${modalCardCls}`}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								<h2 className="font-bold text-lg">
									{editingId ? "Edit Event" : "Add Event"}
								</h2>
								<button
									onClick={() => {
										setShowAddForm(false);
										setEditingId(null);
										setFormData({
											title: "",
											startTime: "",
											endTime: "",
											description: "",
											location: "",
										});
									}}
									className={`p-1.5 rounded-lg ${hoverCls}`}
								>
									<X size={20} />
								</button>
							</div>
							<form onSubmit={handleSubmit} className="space-y-3">
								<input
									type="text"
									placeholder="Event title"
									value={formData.title}
									onChange={(e) =>
										setFormData({ ...formData, title: e.target.value })
									}
									className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
									required
									autoFocus
								/>
								<div className="space-y-2">
									<div className="flex items-center justify-between gap-3">
										<label
											className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-orange-400" : "text-orange-600"}`}
										>
											Time <span className="text-red-500">*</span>{" "}
											<span className="text-xs font-normal opacity-70">
												(Required)
											</span>
										</label>
										<button
											type="button"
											onClick={toggleTimeFormat}
											title={`${is12Hour ? "24시간" : "12시간"} 형식으로 전환`}
											className={`text-[10px] font-medium px-2 py-1 rounded-lg border transition-colors whitespace-nowrap ${
												isDark
													? "border-morning-dark-hover text-morning-dark-muted hover:bg-morning-dark-hover"
													: "border-morning-light-hover/50 text-morning-light-muted hover:bg-morning-light-hover/40"
											}`}
										>
											{is12Hour ? "24h" : "12h"}
										</button>
									</div>
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<span
												className={`text-xs w-10 flex-shrink-0 ${isDark ? "text-gray-400" : "text-gray-600"}`}
											>
												Start
											</span>
											<TimeInput
												value={formData.startTime}
												onChange={(v) =>
													setFormData({ ...formData, startTime: v })
												}
												required
												showFormatToggle={false}
											/>
										</div>
										<div className="flex items-center gap-2">
											<span
												className={`text-xs w-10 flex-shrink-0 ${isDark ? "text-gray-400" : "text-gray-600"}`}
											>
												End
											</span>
											<TimeInput
												value={formData.endTime}
												onChange={(v) =>
													setFormData({ ...formData, endTime: v })
												}
												required
												showFormatToggle={false}
											/>
										</div>
									</div>
								</div>
								<input
									type="text"
									placeholder="Location (optional)"
									value={formData.location}
									onChange={(e) =>
										setFormData({ ...formData, location: e.target.value })
									}
									className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
								/>
								<textarea
									placeholder="Description (optional)"
									value={formData.description}
									onChange={(e) =>
										setFormData({ ...formData, description: e.target.value })
									}
									rows={3}
									className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 resize-none ${inputCls}`}
								/>
								<div className="flex gap-2">
									<button
										type="submit"
										className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors"
									>
										{editingId ? "Save" : "Add"} Event
									</button>
									<button
										type="button"
										onClick={() => {
											setShowAddForm(false);
											setEditingId(null);
											setFormData({
												title: "",
												startTime: "",
												endTime: "",
												description: "",
												location: "",
											});
										}}
										className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${modalSecondaryBtnCls}`}
									>
										Cancel
									</button>
								</div>
							</form>
						</div>
					</div>,
					document.body,
				)}

			{/* PHASE 15: Compact Events List - Filter by selectedDate */}
			<div className="space-y-2 max-h-[300px] overflow-y-auto">
				{events && events.length > 0 ? (
					events
						.filter((event) => event.date === selectedDate)
						.map((event) => (
							<div
								key={event.id}
								onClick={() => setSelectedEventForDetail(event)}
								className={`p-2 rounded-lg border-l-4 border-orange-500 cursor-pointer transition-colors hover:opacity-80 ${`${secondaryBgCls} ${hoverCls}`}`}
							>
								<div className="flex items-center justify-between gap-2">
									<div className="flex-1 min-w-0">
										<h4 className="font-semibold text-xs truncate">
											{event.title}
										</h4>
										{(event.startTime || event.endTime) && (
											<p
												className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
											>
												{event.startTime && event.endTime
													? `${event.startTime} - ${event.endTime}`
													: event.startTime || event.endTime}
											</p>
										)}
									</div>
									<ChevronRight
										size={16}
										className="flex-shrink-0 opacity-50"
									/>
								</div>
							</div>
						))
				) : !loading && !error ? (
					<div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500 font-medium">
						No events
					</div>
				) : null}
			</div>

			{/* PHASE 10: Event Detail Modal */}
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
									{selectedEventForDetail.title}
								</h2>
								<button
									onClick={() => setSelectedEventForDetail(null)}
									className={`p-1.5 rounded-lg ${hoverCls}`}
								>
									<X size={20} />
								</button>
							</div>
							<div className="space-y-3 text-sm">
								{(selectedEventForDetail.startTime ||
									selectedEventForDetail.endTime) && (
									<div>
										<p
											className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											Time
										</p>
										<p>
											{selectedEventForDetail.startTime &&
											selectedEventForDetail.endTime
												? `${selectedEventForDetail.startTime} - ${selectedEventForDetail.endTime}`
												: selectedEventForDetail.startTime ||
													selectedEventForDetail.endTime}
										</p>
									</div>
								)}
								{selectedEventForDetail.location && (
									<div>
										<p
											className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											Location
										</p>
										<p className="flex items-center gap-2">
											<MapPin size={14} /> {selectedEventForDetail.location}
										</p>
									</div>
								)}
								{selectedEventForDetail.description && (
									<div>
										<p
											className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											Description
										</p>
										<p className={isDark ? "text-gray-300" : "text-gray-700"}>
											{selectedEventForDetail.description}
										</p>
									</div>
								)}
							</div>
							<div className="flex gap-2 pt-4 border-t">
								<button
									onClick={() => handleEditFromDetail(selectedEventForDetail)}
									className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${isDark ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400" : "bg-blue-100 hover:bg-blue-200 text-blue-600"}`}
								>
									<Edit2 size={14} /> Edit
								</button>
								<button
									onClick={() => handleDelete(selectedEventForDetail.id)}
									className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400"
								>
									<Trash2 size={14} /> Delete
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{confirmDelete && (
				<ConfirmDialog
					title="이벤트 삭제"
					message="이 이벤트를 삭제하시겠습니까? 되돌릴 수 없습니다."
					confirmLabel="삭제"
					onConfirm={handleConfirmDelete}
					onCancel={() => setConfirmDelete(null)}
				/>
			)}
		</div>
	);
};

export default EventPanel;
