import { useTranslation } from "react-i18next";
import type { RefObject } from "react";
import { Check, Copy, Edit2, MapPin, Trash2, Users, X } from "lucide-react";
import { useTheme } from "../../../hooks/useTheme";
import { getRepeatLabel } from "../../../utils/eventRepeat";
import { safeExternalUrl } from "../../../utils/url";
import {
	formatEventTimeLabel,
	formatMeetLinkLabel,
	formatReminderLabel,
	getDisplayEventTitle,
	type CalendarEventDetail,
} from "./eventFormData";

interface Option {
	value: string;
	label: string;
}

export interface EventDetailProps {
	modalCardCls: string;
	detailDialogRef: RefObject<HTMLDivElement | null>;
	detailDialogProps: Record<string, unknown>;
	selectedEventForDetail: CalendarEventDetail;
	setSelectedEventForDetail: (event: CalendarEventDetail | null) => void;
	noTitleLabel: string;
	visibilityOptions: Option[];
	availabilityOptions: Option[];
	isResolvingSeries: boolean;
	selectedEventDescription: string;
	selectedEventDescriptionHtml: string;
	copiedMeetLink: string;
	handleCopyMeetLink: (url: unknown) => void;
	handleEditFromDetail: (event: CalendarEventDetail) => void;
	handleDelete: (eventId: string | undefined) => void;
}

const EventDetail = ({
	modalCardCls,
	detailDialogRef,
	detailDialogProps,
	selectedEventForDetail,
	setSelectedEventForDetail,
	noTitleLabel,
	visibilityOptions,
	availabilityOptions,
	isResolvingSeries,
	selectedEventDescription,
	selectedEventDescriptionHtml,
	copiedMeetLink,
	handleCopyMeetLink,
	handleEditFromDetail,
	handleDelete,
}: EventDetailProps) => {
	const { t, i18n } = useTranslation();
	const { isDark, hoverCls } = useTheme();

	return (
					<div
						className="fixed inset-0 z-[22000] bg-black/60 backdrop-blur-md flex items-center justify-center"
						onClick={() => setSelectedEventForDetail(null)}
					>
						<div
							ref={detailDialogRef}
							{...detailDialogProps}
							className={`z-[22010] w-full max-w-md rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${modalCardCls}`}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								<h2 id="event-detail-title" className="font-bold text-lg">
									{getDisplayEventTitle(selectedEventForDetail, noTitleLabel)}
								</h2>
								<button
									aria-label={t("common.close")}
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
										{safeExternalUrl(selectedEventForDetail.meetLink) ? (
											<div className="space-y-1.5">
												<div className="flex items-start justify-between gap-3">
													<a
														href={safeExternalUrl(selectedEventForDetail.meetLink)}
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
					</div>
	);
};

export default EventDetail;
