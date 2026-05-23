import { useWidgetStore } from '../store/useWidgetStore';

interface FontSizeResult {
	body: { fontSize: string };
	title: { fontSize: string };
	key: string;
}

export function useFontSize(multiplier = 1.0): FontSizeResult {
	const globalFontSize = useWidgetStore((s) => s.globalFontSize);
	const key = ['small', 'medium', 'large'].includes(globalFontSize) ? globalFontSize : 'medium';
	const bodyBase = ({ small: 10, medium: 12, large: 14 } as Record<string, number>)[key];
	const titleBase = ({ small: 12, medium: 14, large: 16 } as Record<string, number>)[key];
	return {
		body: { fontSize: `${bodyBase * multiplier}px` },
		title: { fontSize: `${titleBase * multiplier}px` },
		key,
	};
}
