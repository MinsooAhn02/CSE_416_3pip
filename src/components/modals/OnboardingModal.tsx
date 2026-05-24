import { Activity, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import { CATEGORIES } from "../../constants";
import Toggle from "../common/Toggle";

const OnboardingModal = () => {
	const { i18n } = useTranslation();
	const { isDark } = useTheme();
	const {
		showOnboarding,
		obStep,
		selCats,
		perms,
		setObStep,
		toggleCat,
		setPerms,
		finishOB,
	} = useOnboardingStore();
	const setVis = useWidgetStore((s) => s.setVis);
	const isKo = i18n.language?.toLowerCase().startsWith("ko");
	const copy = isKo
		? {
				welcomeTitle: "환영합니다!",
				welcomeDesc: "관심사를 선택하면 맞춤 위젯을 추천해드려요",
				next: "다음 →",
				dataTitle: "데이터 연동",
				dataDesc: "외부 서비스를 연결하면 더 스마트한 브리핑을 받아요",
				back: "← 이전",
				finish: "완료 ✓",
				categoryLabels: {
					news: "뉴스",
					tech: "기술",
					fashion: "패션",
					finance: "금융",
					health: "건강",
					food: "음식",
					entertainment: "엔터테인먼트",
					sports: "스포츠",
				},
				fitDesc: "운동량, 수면 패턴 등 건강 데이터",
				calDesc: "일정 이벤트와 Task 연동",
			}
		: {
				welcomeTitle: "Welcome!",
				welcomeDesc:
					"Choose a few interests and we'll recommend widgets for you.",
				next: "Next →",
				dataTitle: "Connect Data",
				dataDesc: "Link external services to unlock smarter briefings.",
				back: "← Back",
				finish: "Finish ✓",
				categoryLabels: {
					news: "News",
					tech: "Tech",
					fashion: "Fashion",
					finance: "Finance",
					health: "Health",
					food: "Food",
					entertainment: "Entertainment",
					sports: "Sports",
				},
				fitDesc: "Health data such as activity, sleep patterns, and more",
				calDesc: "Calendar events and Google Tasks integration",
			};

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
			<div className="bg-slate-800 border border-white/20 rounded-3xl w-full max-w-lg p-8 text-white shadow-2xl">
				{obStep === 0 && (
					<div className="space-y-6">
						<div className="text-center">
							<p className="text-3xl mb-2">👋</p>
							<h2 className="text-2xl font-bold mb-1">{copy.welcomeTitle}</h2>
							<p className="text-white/60 text-sm">{copy.welcomeDesc}</p>
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
										{(copy.categoryLabels as Record<string, string>)[c.id] || c.label}
									</span>
								</button>
							))}
						</div>
						<button
							onClick={() => setObStep(1)}
							className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-colors"
						>
							{copy.next}
						</button>
					</div>
				)}
				{obStep === 1 && (
					<div className="space-y-6">
						<div className="text-center">
							<p className="text-3xl mb-2">🔗</p>
							<h2 className="text-2xl font-bold mb-1">{copy.dataTitle}</h2>
							<p className="text-white/60 text-sm">{copy.dataDesc}</p>
						</div>
						<div className="space-y-3">
							{[
								{
									key: "fit",
									icon: <Activity size={20} className="text-green-400" />,
									label: "Google Fit",
									desc: copy.fitDesc,
								},
								{
									key: "cal",
									icon: <Calendar size={20} className="text-blue-400" />,
									label: "Google Calendar & Tasks",
									desc: copy.calDesc,
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
								{copy.back}
							</button>
							<button
								onClick={handleFinish}
								className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-colors"
							>
								{copy.finish}
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default OnboardingModal;
