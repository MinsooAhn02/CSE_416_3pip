import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Globe, MoreHorizontal, X, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useQuickLinksStore } from "../../store/useQuickLinksStore";

interface EditorPos {
	top: number;
	right: number;
}

const QuickLinks = () => {
	const { isDark, cardCls, inputCls, navBtnCls, secondaryBgCls, borderCls } = useTheme();
	const { t } = useTranslation();
	const { links, showEditor, setShowEditor, addLink, removeLink, updateLink } =
		useQuickLinksStore();

	const [hovered, setHovered] = useState<boolean>(false);
	const [newName, setNewName] = useState<string>("");
	const [newUrl, setNewUrl] = useState<string>("");
	const [newIcon, setNewIcon] = useState<string>("");
	const [newColor, setNewColor] = useState<string>("#4285F4");
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<HTMLDivElement>(null);
	const [editorPos, setEditorPos] = useState<EditorPos>({ top: 0, right: 0 });

	// Close editor on outside click & calculate position
	useEffect(() => {
		if (!showEditor) return;

		// Calculate editor position based on container
		if (containerRef.current) {
			const rect = containerRef.current.getBoundingClientRect();
			setEditorPos({
				top: rect.bottom + 8,
				right: window.innerWidth - rect.right
			});
		}

		const handler = (e: MouseEvent) => {
			if (editorRef.current && !editorRef.current.contains(e.target as Node) &&
				containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setShowEditor(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [showEditor, setShowEditor]);

	const handleAdd = () => {
		if (!newName.trim() || !newUrl.trim()) return;
		let url = newUrl.trim();
		if (!url.startsWith("http")) url = "https://" + url;
		addLink({
			name: newName.trim(),
			url,
			icon: newIcon.trim() || newName.trim().charAt(0).toUpperCase(),
			color: newColor,
		});
		setNewName("");
		setNewUrl("");
		setNewIcon("");
		setNewColor("#4285F4");
	};

	const btnCls = `w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${navBtnCls}`;

	return (
		<div
			className="relative flex items-center"
			ref={containerRef}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => {setHovered(false); setShowEditor(false);}}
		>
			{/* 호버 시 왼쪽으로 펼쳐지는 오버레이 — absolute로 시계를 밀지 않음 */}
			<div
				className={`absolute right-full mr-2 flex items-center gap-1.5 overflow-hidden transition-all duration-300 ease-in-out ${
					hovered
						? "max-w-[500px] opacity-100 backdrop-blur-md bg-white/10 dark:bg-black/20 rounded-full px-2 py-1"
						: "max-w-0 opacity-0"
				}`}
			>
				{/* 편집 버튼 */}
				<button
					onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
						e.stopPropagation();
						setShowEditor(!showEditor);
					}}
					className={btnCls}
					title={t("nav.edit_quicklinks")}
				>
					<MoreHorizontal size={16} className="opacity-60" />
				</button>

				{/* 사이트 링크들 */}
				{links.map((link) => (
					<a
						key={link.id}
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						title={link.name}
						className={`w-10 h-10 rounded-full flex items-center justify-center border text-white text-xs font-bold transition-all hover:scale-110 flex-shrink-0`}
						style={{ backgroundColor: link.color, borderColor: link.color }}
					>
						{link.icon}
					</a>
				))}
			</div>

			{/* 메인 지구본 아이콘 (항상 표시) */}
			<button className={btnCls} title={t("nav.quicklinks")}>
				<Globe size={18} className="opacity-60" />
			</button>

			{/* Editor popup — rendered as portal to escape stacking context */}
			{showEditor && createPortal(
				<div
					ref={editorRef}
					className={`fixed w-80 rounded-2xl shadow-2xl border p-4 z-[10001] ${
						cardCls
					}`}
					style={{
						top: `${editorPos.top}px`,
						right: `${editorPos.right}px`
					}}
				>
					<div className="flex items-center justify-between mb-3 ">
						<h3 className="text-sm font-bold">{t("nav.edit_quicklinks")}</h3>
						<button onClick={() => setShowEditor(false)}>
							<X size={16} className="opacity-60 hover:opacity-100" />
						</button>
					</div>

					{/* Existing links list */}
					<div className="space-y-2 mb-4 max-h-48 overflow-y-auto diary-scroll">
						{links.map((link) => (
							<div
								key={link.id}
								className={`flex items-center gap-2 p-2 rounded-lg ${
									secondaryBgCls
								}`}
							>
								<div
									className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
									style={{ backgroundColor: link.color }}
								>
									{link.icon}
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-xs font-medium truncate">{link.name}</p>
									<p className="text-[10px] opacity-50 truncate">{link.url}</p>
								</div>
								<button
									onClick={() => removeLink(link.id)}
									className="text-red-400 hover:text-red-300 flex-shrink-0"
								>
									<Trash2 size={14} />
								</button>
							</div>
						))}
					</div>

					{/* Add new link */}
					<div className={`border-t pt-3 ${borderCls}`}>
						<p className="text-xs font-medium mb-2 opacity-70">{t("nav.add_new_link")}</p>
						<div className="space-y-2">
							<input
								type="text"
								value={newName}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
								placeholder={t("nav.link_name")}
								className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
							/>
							<input
								type="text"
								value={newUrl}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUrl(e.target.value)}
								placeholder={t("nav.link_url")}
								className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
							/>
							<div className="flex gap-2 items-center h-8">
								<input
									type="text"
									value={newIcon}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewIcon(e.target.value)}
									placeholder={t("nav.link_icon")}
									className={`flex-1 h-8 w-4 rounded-lg px-3 py-0 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
								/>
								<input
									type="color"
									value={newColor}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewColor(e.target.value)}
									className="w-8 h-8 border-0 cursor-pointer appearance-none flex-shrink-0"
								/>
								<button
									onClick={handleAdd}
									className="h-8 bg-blue-500 hover:bg-blue-400 text-white px-3 py-0 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
								>
									<Plus size={12} /> {t("common.add")}
								</button>
							</div>
						</div>
					</div>
				</div>,
				document.body
			)}
		</div>
	);
};

export default QuickLinks;
