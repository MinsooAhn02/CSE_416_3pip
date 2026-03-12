import { GripVertical } from "lucide-react";
import { useWidgetStore } from "../../store/useWidgetStore";

const EditModeBanner = () => {
	const editMode = useWidgetStore((s) => s.editMode);
	const setEditMode = useWidgetStore((s) => s.setEditMode);

	if (!editMode) return null;

	return (
		<div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-full backdrop-blur-md shadow-lg border flex items-center gap-3 bg-blue-500/90 border-blue-400 text-white">
			<GripVertical size={16} />
			<span className="text-sm font-medium">
				편집 모드 — 위젯을 드래그하여 위치를 변경하세요
			</span>
			<button
				onClick={() => setEditMode(false)}
				className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs font-bold transition-colors"
			>
				완료
			</button>
		</div>
	);
};

export default EditModeBanner;
