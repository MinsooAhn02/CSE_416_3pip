import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useFontSize } from "../../hooks/useFontSize";

export const SkeletonLine = ({ width = "100%" }) => (
	<div
		className="h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"
		style={{ width }}
	/>
);

export const BriefingSkeleton = () => (
	<motion.div
		className="space-y-3"
		initial={{ opacity: 0 }}
		animate={{ opacity: 1 }}
		exit={{ opacity: 0 }}
		transition={{ duration: 0.3 }}
	>
		<SkeletonLine width="90%" />
		<SkeletonLine width="100%" />
		<SkeletonLine width="85%" />
		<div className="h-2" />
		<SkeletonLine width="95%" />
		<SkeletonLine width="80%" />
		<SkeletonLine width="100%" />
		<SkeletonLine width="70%" />
		<div className="h-2" />
		<SkeletonLine width="88%" />
		<SkeletonLine width="92%" />
		<SkeletonLine width="75%" />
	</motion.div>
);

/**
 * Shared presentational component for rendering detailed briefing sections
 * inside a scrollable modal body. Used by BriefingWidget and FirstLoginBriefingModal.
 */
const BriefingSectionsView = ({
	displayBriefing,
	detailLines,
	isLoading,
	lastGenerated,
}) => {
	const { isDark, muted } = useTheme();
	const { t, i18n } = useTranslation();
	const { body: modalBodyFontStyle } = useFontSize(1.2);
	const modalBodyText = isDark
		? "text-morning-dark-text/90"
		: "text-morning-light-text/85";

	return (
		<div className="flex-1 overflow-y-auto p-5 space-y-4">
			<AnimatePresence mode="wait">
				{isLoading ? (
					<BriefingSkeleton key="skeleton" />
				) : (
					<motion.div
						key="content"
						className={`divide-y ${
							isDark
								? "divide-morning-dark-hover"
								: "divide-morning-light-hover/40"
						}`}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.3 }}
					>
						{displayBriefing.sections.length > 0 ? (
							displayBriefing.sections.map((section) => (
								<div key={section.id} className="py-3 first:pt-0 last:pb-0">
									<p
										className={`text-[11px] font-bold uppercase tracking-widest mb-1.5 ${
											isDark ? "text-blue-300" : "text-blue-700"
										}`}
									>
										{section.title}
									</p>
									{Array.isArray(section.subBlocks) &&
									section.subBlocks.length > 0 ? (
										<div className="space-y-2.5">
											{section.subBlocks.map((sb) => (
												<div key={sb.id}>
													<p
														className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
															isDark ? "text-blue-400/80" : "text-blue-600/80"
														}`}
													>
														{sb.title}
													</p>
													<div className="space-y-2">
														{(sb.lines ?? []).map((line, idx) =>
															line && typeof line === "object" ? (
																<div key={idx} className="space-y-0.5">
																	<p style={modalBodyFontStyle}>
																		<a
																			href={line.url}
																			target="_blank"
																			rel="noopener noreferrer"
																			className={`font-medium underline underline-offset-2 ${isDark ? "text-blue-300 hover:text-blue-200" : "text-blue-700 hover:text-blue-900"}`}
																			style={modalBodyFontStyle}
																			onClick={(e) => e.stopPropagation()}
																		>
																			{line.title}
																		</a>
																		{line.source && (
																			<span className={`ml-1.5 text-[10px] ${muted}`}>
																				— {line.source}
																			</span>
																		)}
																	</p>
																	{line.summary && (
																		<p
																			className={`leading-relaxed ${modalBodyText} pl-0`}
																			style={modalBodyFontStyle}
																		>
																			{line.summary}
																		</p>
																	)}
																</div>
															) : (
																<p
																	key={idx}
																	className={`leading-relaxed ${modalBodyText}`}
																	style={modalBodyFontStyle}
																>
																	{line}
																</p>
															)
														)}
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="space-y-1">
											{(section.lines ?? []).map((line, idx) => (
												<p
													key={idx}
													className={`leading-relaxed ${modalBodyText}`}
													style={modalBodyFontStyle}
												>
													{line}
												</p>
											))}
										</div>
									)}
								</div>
							))
						) : detailLines.length > 0 ? (
							<div className="py-1 space-y-3">
								{detailLines.map((line, idx) => (
									<p
										key={idx}
										className={`leading-relaxed ${modalBodyText}`}
										style={modalBodyFontStyle}
									>
										{line}
									</p>
								))}
							</div>
						) : (
							<p className={`text-sm ${muted}`}>
								{t("briefing.loading_detail")}
							</p>
						)}
					</motion.div>
				)}
			</AnimatePresence>

			{lastGenerated && (
				<p className={`text-[10px] ${muted} text-right`}>
					{t("briefing.last_updated")}:{" "}
					{lastGenerated.toLocaleTimeString(
						i18n.language === "ko" ? "ko-KR" : "en-US",
						{ hour: "2-digit", minute: "2-digit" },
					)}
				</p>
			)}
		</div>
	);
};

export default BriefingSectionsView;
