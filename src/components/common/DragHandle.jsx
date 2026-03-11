import { GripVertical } from "lucide-react";
import { useWidgetStore } from "../../store/useWidgetStore";

const DragHandle = () => {
	const editMode = useWidgetStore((s) => s.editMode);

	if (!editMode) return null;

	return (
		<div className="drag-handle cursor-grab active:cursor-grabbing p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity text-blue-400">
			<GripVertical size={14} />
		</div>
	);
};

export default DragHandle;
