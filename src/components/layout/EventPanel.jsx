import { useState, useEffect } from "react";
import { Plus, X, Trash2, Clock, MapPin, Edit2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../hooks/useTheme";
import { useGoogleCalendarStore } from "../../store/useGoogleCalendarStore";

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
	const { isDark, cardCls, inputCls } = useTheme();
	const { events, loading, error, addEvent, deleteEvent, updateEvent } = useGoogleCalendarStore();

	const [showAddForm, setShowAddForm] = useState(false);
	const [selectedEventForDetail, setSelectedEventForDetail] = useState(null);
	const [editingId, setEditingId] = useState(null);
	const [formData, setFormData] = useState({
		title: "",
		startTime: "",
		endTime: "",
		description: "",
		location: "",
	});

	/* REFINEMENT #5: Reset form state when selectedDate changes */
	useEffect(() => {
		setShowAddForm(false);
		setEditingId(null);
		setSelectedEventForDetail(null);
		setFormData({ title: "", startTime: "", endTime: "", description: "", location: "" });
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
			setFormData({ title: "", startTime: "", endTime: "", description: "", location: "" });
			setShowAddForm(false);
		} catch (err) {
			console.error("Failed to save event:", err);
		}
	};

	/* Handle delete */
	const handleDelete = async (eventId) => {
		if (!confirm("Delete this event?")) return;
		try {
			await deleteEvent(eventId);
			setSelectedEventForDetail(null);
		} catch (err) {
			console.error("Failed to delete event:", err);
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
						if (!showAddForm) setFormData({ title: "", startTime: "", endTime: "", description: "", location: "" });
					}}
					className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
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
				<div className={`p-3 rounded-lg text-xs ${isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"}`}>
					{error}
				</div>
			)}

			{/* PHASE 10: Add Form Modal */}
			<AnimatePresence>
				{showAddForm && (
					<motion.div
						className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center"
						onClick={() => {
							setShowAddForm(false);
							setEditingId(null);
							setFormData({ title: "", startTime: "", endTime: "", description: "", location: "" });
						}}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
					>
						<motion.div
							className={`z-51 w-full max-w-md rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${
								isDark
									? "bg-morning-dark-card border-morning-dark-hover"
									: "bg-morning-light-card border-morning-light-hover/50"
							}`}
							initial={{ opacity: 0, scale: 0.9, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9, y: 20 }}
							transition={{ type: "spring", damping: 25, stiffness: 300 }}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								<h2 className="font-bold text-lg">{editingId ? "Edit Event" : "Add Event"}</h2>
								<button
									onClick={() => {
										setShowAddForm(false);
										setEditingId(null);
										setFormData({ title: "", startTime: "", endTime: "", description: "", location: "" });
									}}
									className={`p-1.5 rounded-lg ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
								>
									<X size={20} />
								</button>
							</div>
							<form onSubmit={handleSubmit} className="space-y-3">
								<input
									type="text"
									placeholder="Event title"
									value={formData.title}
									onChange={(e) => setFormData({ ...formData, title: e.target.value })}
									className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
									required
									autoFocus
								/>
								<div className="space-y-1">
									<label className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-orange-400" : "text-orange-600"}`}>
										Time <span className="text-red-500">*</span> <span className="text-xs font-normal opacity-70">(Required)</span>
									</label>
									<div className="grid grid-cols-2 gap-3">
										{/* Start Time */}
										<div className="space-y-1">
											<label className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>Start</label>
											<div className="flex items-center gap-2">
												<Clock size={16} className="text-gray-900 dark:text-white" />
												<input
													type="time"
													value={formData.startTime}
													onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
													className={`flex-1 px-2 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
													required
												/>
											</div>
										</div>
										{/* End Time */}
										<div className="space-y-1">
											<label className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>End</label>
											<div className="flex items-center gap-2">
												<Clock size={16} className="text-gray-900 dark:text-white" />
												<input
													type="time"
													value={formData.endTime}
													onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
													className={`flex-1 px-2 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
													required
												/>
											</div>
										</div>
									</div>
								</div>
								<input
									type="text"
									placeholder="Location (optional)"
									value={formData.location}
									onChange={(e) => setFormData({ ...formData, location: e.target.value })}
									className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
								/>
								<textarea
									placeholder="Description (optional)"
									value={formData.description}
									onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
											setFormData({ title: "", startTime: "", endTime: "", description: "", location: "" });
										}}
										className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? "bg-[#2a2a2a] hover:bg-[#353535]" : "bg-gray-100 hover:bg-gray-200"}`}
									>
										Cancel
									</button>
								</div>
							</form>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* PHASE 15: Compact Events List - Filter by selectedDate */}
			<div className="space-y-2 max-h-[300px] overflow-y-auto">
				{events && events.length > 0 ? (
					events.filter(event => event.date === selectedDate).map((event) => (
						<div
							key={event.id}
							onClick={() => setSelectedEventForDetail(event)}
							className={`p-2 rounded-lg border-l-4 border-orange-500 cursor-pointer transition-colors hover:opacity-80 ${
								isDark ? "bg-[#2a2a2a] hover:bg-[#353535]" : "bg-gray-50 hover:bg-gray-100"
							}`}
						>
							<div className="flex items-center justify-between gap-2">
								<div className="flex-1 min-w-0">
									<h4 className="font-semibold text-xs truncate">{event.title}</h4>
									{(event.startTime || event.endTime) && (
										<p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
											{event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : (event.startTime || event.endTime)}
										</p>
									)}
								</div>
								<ChevronRight size={16} className="flex-shrink-0 opacity-50" />
							</div>
						</div>
					))
				) : !loading && !error ? (
				<div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500 font-medium">No events</div>
			) : null}
			</div>

			{/* PHASE 10: Event Detail Modal */}
			<AnimatePresence>
				{selectedEventForDetail && (
					<motion.div
						className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center"
						onClick={() => setSelectedEventForDetail(null)}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
					>
						<motion.div
							className={`z-51 w-full max-w-md rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${
								isDark
									? "bg-morning-dark-card border-morning-dark-hover"
									: "bg-morning-light-card border-morning-light-hover/50"
							}`}
							initial={{ opacity: 0, scale: 0.9, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9, y: 20 }}
							transition={{ type: "spring", damping: 25, stiffness: 300 }}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								<h2 className="font-bold text-lg">{selectedEventForDetail.title}</h2>
								<button
									onClick={() => setSelectedEventForDetail(null)}
									className={`p-1.5 rounded-lg ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
								>
									<X size={20} />
								</button>
							</div>
							<div className="space-y-3 text-sm">
								{(selectedEventForDetail.startTime || selectedEventForDetail.endTime) && (
									<div>
										<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Time</p>
										<p>
											{selectedEventForDetail.startTime && selectedEventForDetail.endTime 
												? `${selectedEventForDetail.startTime} - ${selectedEventForDetail.endTime}`
												: (selectedEventForDetail.startTime || selectedEventForDetail.endTime)
											}
										</p>
									</div>
								)}
								{selectedEventForDetail.location && (
									<div>
										<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Location</p>
										<p className="flex items-center gap-2">
											<MapPin size={14} /> {selectedEventForDetail.location}
										</p>
									</div>
								)}
								{selectedEventForDetail.description && (
									<div>
										<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Description</p>
										<p className={isDark ? "text-gray-300" : "text-gray-700"}>{selectedEventForDetail.description}</p>
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
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export default EventPanel;
