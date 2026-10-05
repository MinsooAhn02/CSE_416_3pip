import { Activity, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useDialog } from "../../hooks/useDialog";
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import { CATEGORIES } from "../../constants";
import Toggle from "../common/Toggle";

const OnboardingModal = () => {
	const { t } = useTranslation();
	const {
		showOnboarding,
		obStep,
		selCats,
		perms,
		setObStep,
		toggleCat,
		setPerms,
		finishOB,
	} = useOnboardingStore(
		useShallow((s) => ({
			showOnboarding: s.showOnboarding,
			obStep: s.obStep,
			selCats: s.selCats,
			perms: s.perms,
			setObStep: s.setObStep,
			toggleCat: s.toggleCat,
			setPerms: s.setPerms,
			finishOB: s.finishOB,
		})),
	);
	const setVis = useWidgetStore((s) => s.setVis);
	// 필수 단계 — Escape로 닫을 수 없음, 포커스 가두기만 적용
	const { ref: dialogRef, dialogProps } = useDialog<HTMLDivElement>({
		open: showOnboarding,
		canClose: false,
		labelledBy: "onboarding-title",
	});

	if (!showOnboarding) return null;

	const handleFinish = () => {
		finishOB();
		const nv: Record<string, boolean> = {};
		if (perms.cal) nv.calendar = true;
		if (perms.fit) nv.health = true;
		if (Object.keys(nv).length > 0) {
			setVis((prev) => ({ ...prev, ...nv }));
		}
	};

	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div ref={dialogRef} {...dialogProps} className="bg-slate-800 border border-white/20 rounded-3xl w-full max-w-lg p-8 text-white shadow-2xl">
				{obStep === 0 && (
					<div className="space-y-6">
						<div className="text-center">
							<p className="text-3xl mb-2">👋</p>
							<h2 id="onboarding-title" className="text-2xl font-bold mb-1">{t("onboarding.welcome_title")}</h2>
							<p className="text-white/60 text-sm">{t("onboarding.welcome_desc")}</p>
						</div>
						<div className="grid grid-cols-2 gap-3">
							{CATEGORIES.map((c) => (
								<button
									key={c.id}
									onClick={() => toggleCat(c.id)}
									className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
										selCats.includes(c.id)
											? "border-blue-500 bg-blue-500/20"
											: "border-white/10 bg-white/5 hover:bg-white/10"
									}`}
								>
									<span className="text-xl">{c.emoji}</span>
									<span className="font-medium text-sm">
										{t(`categories.${c.id}`, { defaultValue: c.label })}
									</span>
								</button>
							))}
						</div>
						<button
							onClick={() => setObStep(1)}
							className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-colors"
						>
							{t("onboarding.next")}
						</button>
					</div>
				)}
				{obStep === 1 && (
					<div className="space-y-6">
						<div className="text-center">
							<p className="text-3xl mb-2">🔗</p>
							<h2 id="onboarding-title" className="text-2xl font-bold mb-1">{t("onboarding.data_title")}</h2>
							<p className="text-white/60 text-sm">{t("onboarding.data_desc")}</p>
						</div>
						<div className="space-y-3">
							{[
								{
									key: "fit",
									icon: <Activity size={20} className="text-green-400" />,
									label: "Google Fit",
									desc: t("onboarding.fit_desc"),
								},
								{
									key: "cal",
									icon: <Calendar size={20} className="text-blue-400" />,
									label: "Google Calendar & Tasks",
									desc: t("onboarding.cal_desc"),
								},
							].map((item) => (
								<div
									key={item.key}
									className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
								>
									<div className="flex items-center gap-3">
										{item.icon}
										<div>
											<p className="font-medium text-sm">{item.label}</p>
											<p className="text-xs text-white/40">{item.desc}</p>
										</div>
									</div>
									<Toggle
										on={(perms as unknown as Record<string, boolean>)[item.key]}
										onToggle={() =>
											setPerms((p) => ({
												...p,
												[item.key]: !(p as unknown as Record<string, boolean>)[item.key],
											}))
										}
									/>
								</div>
							))}
						</div>
						<div className="flex gap-3">
							<button
								onClick={() => setObStep(0)}
								className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold transition-colors"
							>
								{t("onboarding.back")}
							</button>
							<button
								onClick={handleFinish}
								className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-colors"
							>
								{t("onboarding.finish")}
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default OnboardingModal;
