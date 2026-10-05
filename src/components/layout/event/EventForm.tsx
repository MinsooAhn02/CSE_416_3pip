import React from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import {
	Bell,
	Bold,
	Clock,
	Eye,
	Italic,
	Link2,
	List,
	ListOrdered,
	Repeat,
	Strikethrough,
	Underline,
	Users,
	Video,
	X,
} from "lucide-react";
import { useTheme } from "../../../hooks/useTheme";
import type { RepeatOption } from "../../../utils/eventRepeat";
import GooglePlacesLocationField from "../../common/GooglePlacesLocationField";
import TimeInput from "../../common/TimeInput";
import { EMPTY_DESCRIPTION_FORMAT_STATE } from "./eventDescription";
import { formatReminderMinutes, getEmptyForm, type EventFormData } from "./eventFormData";

interface Option {
	value: string;
	label: string;
}

type DescriptionFormatState = typeof EMPTY_DESCRIPTION_FORMAT_STATE;

export interface EventFormProps {
	modalCardCls: string;
	modalSecondaryBtnCls: string;
	addFormDialogRef: RefObject<HTMLDivElement | null>;
	addFormDialogProps: Record<string, unknown>;
	handleCloseAddForm: () => void;
	handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	editingId: string | null;
	activeFormDate: string;
	formData: EventFormData;
	setFormData: Dispatch<SetStateAction<EventFormData>>;
	repeatOptions: RepeatOption[];
	weekDaysShort: { code: string; label: string }[];
	customFrequencyOptions: Option[];
	visibilityOptions: Option[];
	availabilityOptions: Option[];
	reminderModeOptions: Option[];
	reminderMinuteOptions: number[];
	toggleCustomDay: (code: string) => void;
	// rich-text description editor (refs/state owned by EventPanel)
	descriptionEditorRef: RefObject<HTMLDivElement | null>;
	isDescriptionEditorFocused: boolean;
	setIsDescriptionEditorFocused: Dispatch<SetStateAction<boolean>>;
	showDescriptionLinkInput: boolean;
	setShowDescriptionLinkInput: Dispatch<SetStateAction<boolean>>;
	descriptionLinkValue: string;
	setDescriptionLinkValue: Dispatch<SetStateAction<string>>;
	descriptionFormatState: DescriptionFormatState;
	setDescriptionFormatState: Dispatch<SetStateAction<DescriptionFormatState>>;
	syncDescriptionFromEditor: () => void;
	saveDescriptionSelection: () => void;
	updateDescriptionFormatState: () => void;
	applyDescriptionFormat: (command: string, value?: string | null) => void;
	handleDescriptionToolbarMouseDown: (event: React.MouseEvent, callback: () => void) => void;
	handleApplyDescriptionLink: () => void;
	getDescriptionToolbarButtonCls: (isActive: boolean) => string;
}

const EventForm = ({
	modalCardCls,
	modalSecondaryBtnCls,
	addFormDialogRef,
	addFormDialogProps,
	handleCloseAddForm,
	handleSubmit,
	editingId,
	activeFormDate,
	formData,
	setFormData,
	repeatOptions,
	weekDaysShort,
	customFrequencyOptions,
	visibilityOptions,
	availabilityOptions,
	reminderModeOptions,
	reminderMinuteOptions,
	toggleCustomDay,
	descriptionEditorRef,
	isDescriptionEditorFocused,
	setIsDescriptionEditorFocused,
	showDescriptionLinkInput,
	setShowDescriptionLinkInput,
	descriptionLinkValue,
	setDescriptionLinkValue,
	descriptionFormatState,
	setDescriptionFormatState,
	syncDescriptionFromEditor,
	saveDescriptionSelection,
	updateDescriptionFormatState,
	applyDescriptionFormat,
	handleDescriptionToolbarMouseDown,
	handleApplyDescriptionLink,
	getDescriptionToolbarButtonCls,
}: EventFormProps) => {
	const { t, i18n } = useTranslation();
	const { isDark, inputCls, hoverCls, secondaryBgCls } = useTheme();

	return (
					<div
						className="fixed inset-0 z-[22000] bg-black/60 backdrop-blur-md flex items-center justify-center"
						onClick={handleCloseAddForm}
					>
						<div
							ref={addFormDialogRef}
							{...addFormDialogProps}
							className={`z-[22010] w-full max-w-xl md:max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${modalCardCls}`}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								<h2 id="event-form-title" className="font-bold text-lg">
									{editingId ? t("events.edit_event") : t("events.add_event")}
								</h2>
								<button
									type="button"
									onClick={handleCloseAddForm}
									aria-label={t("common.close")}
									className={`p-1.5 rounded-lg ${hoverCls}`}
								>
									<X size={20} />
								</button>
							</div>

							<form onSubmit={handleSubmit} className="space-y-3 pr-1">
								{/* 넓은 화면: 기본 정보 | 참석자·설명·옵션 2열 → 스크롤 없이 한 화면에 */}
								<div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
								<div className="space-y-3 min-w-0">
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
								</div>
								<div className="space-y-3 min-w-0">
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
					</div>
	);
};

export default EventForm;
