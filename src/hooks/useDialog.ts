import { useEffect, useRef, type RefObject } from "react";

/**
 * 모달·팝업 공통 접근성 동작 (BACKLOG I2).
 * - Escape로 닫기 (canClose=false면 막음 — 예: 필수 온보딩)
 * - 열릴 때 팝업 안 첫 포커스 가능 요소로 이동, Tab/Shift+Tab은 팝업 안에서만 순환
 * - 닫히면 열기 전 포커스 위치로 복귀
 * 사용: const { ref, dialogProps } = useDialog<HTMLDivElement>({ open, onClose, labelledBy: "x-title" });
 *       <div ref={ref} {...dialogProps}>…</div>  (팝업 카드 요소에 — 배경 오버레이가 아니라)
 * 여러 개가 겹쳐 열리면 가장 나중에 열린 팝업만 Escape/Tab을 처리.
 */

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

// 열린 팝업 스택 — 맨 위 것만 키 입력 처리
const openStack: symbol[] = [];

interface UseDialogOptions {
	open: boolean;
	onClose?: () => void;
	/** false면 Escape로 닫히지 않음 (포커스 가두기는 유지) */
	canClose?: boolean;
	/** 제목 요소 id → aria-labelledby */
	labelledBy?: string;
}

export function useDialog<T extends HTMLElement = HTMLDivElement>({
	open,
	onClose,
	canClose = true,
	labelledBy,
}: UseDialogOptions): {
	ref: RefObject<T | null>;
	dialogProps: { role: "dialog"; "aria-modal": true; "aria-labelledby"?: string; tabIndex: -1 };
} {
	const ref = useRef<T>(null);
	// 최신 콜백/옵션을 effect 재실행 없이 참조
	const onCloseRef = useRef(onClose);
	const canCloseRef = useRef(canClose);
	onCloseRef.current = onClose;
	canCloseRef.current = canClose;

	useEffect(() => {
		if (!open) return;
		const id = Symbol("dialog");
		openStack.push(id);
		const previouslyFocused = document.activeElement as HTMLElement | null;

		// 렌더 직후 포커스 이동 (autoFocus 요소가 이미 있으면 그대로 둠)
		const raf = requestAnimationFrame(() => {
			const root = ref.current;
			if (!root || root.contains(document.activeElement)) return;
			const first = root.querySelector<HTMLElement>(FOCUSABLE);
			(first ?? root).focus();
		});

		const onKeyDown = (e: KeyboardEvent) => {
			if (openStack[openStack.length - 1] !== id) return;
			const root = ref.current;
			if (!root) return;
			if (e.key === "Escape") {
				// 안쪽 요소(자동완성 목록 등)가 이미 Escape를 처리했으면 팝업은 닫지 않음
				if (e.defaultPrevented) return;
				if (canCloseRef.current && onCloseRef.current) {
					e.stopPropagation();
					onCloseRef.current();
				}
				return;
			}
			if (e.key !== "Tab") return;
			const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
				(el) => el.offsetParent !== null || el === document.activeElement,
			);
			if (items.length === 0) {
				e.preventDefault();
				root.focus();
				return;
			}
			const first = items[0];
			const last = items[items.length - 1];
			const active = document.activeElement;
			if (e.shiftKey && (active === first || !root.contains(active))) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && (active === last || !root.contains(active))) {
				e.preventDefault();
				first.focus();
			}
		};

		document.addEventListener("keydown", onKeyDown);
		return () => {
			cancelAnimationFrame(raf);
			document.removeEventListener("keydown", onKeyDown);
			const idx = openStack.lastIndexOf(id);
			if (idx >= 0) openStack.splice(idx, 1);
			// 닫힌 뒤 원래 위치로 (그 요소가 아직 화면에 있을 때만)
			if (previouslyFocused?.isConnected) previouslyFocused.focus();
		};
	}, [open]);

	return {
		ref,
		dialogProps: {
			role: "dialog",
			"aria-modal": true,
			...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
			tabIndex: -1,
		},
	};
}
