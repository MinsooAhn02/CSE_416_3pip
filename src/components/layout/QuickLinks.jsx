import { useState, useRef, useEffect } from "react";
import { Globe, MoreHorizontal, X, Plus, Trash2 } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useQuickLinksStore } from "../../store/useQuickLinksStore";

const QuickLinks = () => {
	const { isDark, cardCls, inputCls } = useTheme();
	const { links, showEditor, setShowEditor, addLink, removeLink, updateLink } =
		useQuickLinksStore();

	const [hovered, setHovered] = useState(false);
	const [newName, setNewName] = useState("");
	const [newUrl, setNewUrl] = useState("");
	const [newIcon, setNewIcon] = useState("");
	const [newColor, setNewColor] = useState("#4285F4");
	const containerRef = useRef(null);
	const editorRef = useRef(null);

	// Close editor on outside click
	useEffect(() => {
		if (!showEditor) return;
		const handler = (e) => {
			if (editorRef.current && !editorRef.current.contains(e.target)) {
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

	const btnCls = `w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
		isDark
			? "bg-[#2a2a2a] hover:bg-[#353535] border-[#3a3a3a]"
			: "bg-white/50 hover:bg-white/80 border-gray-200"
	}`;

	return (
		<div
			className="relative flex items-center"
			ref={containerRef}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
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
					onClick={(e) => {
						e.stopPropagation();
						setShowEditor(!showEditor);
					}}
					className={btnCls}
					title="즐겨찾기 편집"
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
			<button className={btnCls} title="즐겨찾기">
				<Globe size={18} className="opacity-60" />
			</button>

			{/* Editor popup */}
			{showEditor && (
				<div
					ref={editorRef}
					className={`absolute top-12 right-0 w-80 rounded-2xl shadow-2xl border p-4 z-50 ${
						isDark
							? "bg-[#2a2a2a] border-[#3a3a3a] text-white"
							: "bg-white border-gray-200 text-slate-800"
					}`}
				>
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-bold">즐겨찾기 편집</h3>
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
									isDark ? "bg-[#333333]" : "bg-gray-50"
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
					<div className={`border-t pt-3 ${isDark ? "border-[#444444]" : "border-gray-200"}`}>
						<p className="text-xs font-medium mb-2 opacity-70">새 링크 추가</p>
						<div className="space-y-2">
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="이름 (예: 깃허브)"
								className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
							/>
							<input
								type="text"
								value={newUrl}
								onChange={(e) => setNewUrl(e.target.value)}
								placeholder="URL (예: github.com)"
								className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
							/>
							<div className="flex gap-2">
								<input
									type="text"
									value={newIcon}
									onChange={(e) => setNewIcon(e.target.value)}
									placeholder="아이콘 (예: GH)"
									className={`flex-1 rounded-lg px-3 py-1.5 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
								/>
								<input
									type="color"
									value={newColor}
									onChange={(e) => setNewColor(e.target.value)}
									className="w-8 h-8 rounded-lg border-0 cursor-pointer"
								/>
								<button
									onClick={handleAdd}
									className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
								>
									<Plus size={12} /> 추가
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default QuickLinks;
