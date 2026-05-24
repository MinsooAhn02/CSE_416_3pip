import { useOnboardingStore } from "../store/useOnboardingStore";
import { useDataStore } from "../store/useDataStore";
import { useDiaryStore } from "../store/useDiaryStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { mergeInterestLists } from "./interests";
import { formatLocalDate } from "./date";
import type { PersonaContext } from "../types";

interface BuildPersonaContextOptions {
	memoDays?: number;
	memoLimit?: number;
	includeMemo?: boolean;
	beforeDate?: string;
}

export const buildPersonaContext = ({
	memoDays = 14,
	memoLimit = 5,
	includeMemo = true,
	beforeDate = formatLocalDate(),
}: BuildPersonaContextOptions = {}): PersonaContext => {
	const onboardingState = useOnboardingStore.getState();
	const dataState = useDataStore.getState();
	const diaryState = useDiaryStore.getState();
	const settingsState = useSettingsStore.getState();

	return {
		persona:
			onboardingState.persona ?? (dataState.onboardingProfile?.persona ?? null),
		age: dataState.onboardingProfile?.age ?? null,
		interests: mergeInterestLists(
			settingsState.fixedInterestIds ??
				dataState.onboardingProfile?.interests ??
				onboardingState.selCats ??
				[],
			settingsState.keywordInterests ?? [],
		)
			.slice(0, 10)
			.map((i) => i.keyword),
		job: null,
		memo: includeMemo
			? (diaryState.getRecentMemoSummary?.({
					beforeDate,
					days: memoDays,
					limit: memoLimit,
					includeSameDate: false,
				}) || "")
			: "",
	};
};
