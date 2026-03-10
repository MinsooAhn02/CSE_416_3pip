import React, { useState, useEffect } from "react";
import {
	Search,
	Settings,
	Sun,
	TrendingUp,
	CheckCircle2,
	ExternalLink,
	User,
	Plus,
	MoreVertical,
	Globe,
	Clock,
	BarChart3,
	CloudSun,
	X,
} from "lucide-react";
import {
	mockBookmarks,
	fetchWeather,
	fetchStocks,
	fetchTrends,
	fetchBriefing,
	mockTodos,
} from "./mock/data";

const App = () => {
	const [currentTime, setCurrentTime] = useState(new Date());
	const [todo, setTodo] = useState(mockTodos);
	const [newTodoText, setNewTodoText] = useState("");
	const [showAddTodo, setShowAddTodo] = useState(false);
	const [weather, setWeather] = useState(null);
	const [stocks, setStocks] = useState([]);
	const [trends, setTrends] = useState([]);
	const [briefing, setBriefing] = useState(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [showSettings, setShowSettings] = useState(false);

	// 시계 업데이트
	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	// Mock 데이터 로드
	useEffect(() => {
		fetchWeather().then(setWeather);
		fetchStocks().then(setStocks);
		fetchTrends().then(setTrends);
		fetchBriefing().then(setBriefing);
	}, []);

	const timeString = currentTime.toLocaleTimeString("ko-KR", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	const dateString = currentTime.toLocaleDateString("ko-KR", {
		month: "long",
		day: "numeric",
		weekday: "long",
	});

	// TO-DO 토글
	const toggleTodo = (id) => {
		setTodo((prev) =>
			prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
		);
	};

	// TO-DO 추가
	const addTodo = () => {
		const text = newTodoText.trim();
		if (!text) return;
		setTodo((prev) => [...prev, { id: Date.now(), text, completed: false }]);
		setNewTodoText("");
		setShowAddTodo(false);
	};

	// TO-DO 삭제
	const deleteTodo = (id) => {
		setTodo((prev) => prev.filter((t) => t.id !== id));
	};

	// 검색
	const handleSearch = (e) => {
		e.preventDefault();
		if (searchQuery.trim()) {
			window.open(
				`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
				"_blank",
				"noopener,noreferrer",
			);
		}
	};

	const WidgetCard = ({ title, icon: Icon, children }) => (
		<div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-xl text-white mb-4 transition-all hover:bg-white/[0.12]">
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					{Icon && <Icon size={18} className="text-blue-300" />}
					<h3 className="font-semibold text-sm opacity-90">{title}</h3>
				</div>
				<MoreVertical
					size={14}
					className="opacity-50 cursor-pointer hover:opacity-100 transition-opacity"
				/>
			</div>
			{children}
		</div>
	);

	return (
		<div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 font-sans text-slate-100 overflow-hidden relative">
			{/* Background Decorative Elements */}
			<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
			<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />

			{/* Top Navigation Bar */}
			<div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10">
				<div className="flex flex-col gap-4">
					{/* Profile & Identity */}
					<div className="flex items-center gap-3 mb-2">
						<div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white/30">
							<User size={20} />
						</div>
						<div>
							<p className="text-xs opacity-60">안녕하세요,</p>
							<p className="font-bold text-sm tracking-tight">
								MorningBrief.AI User
							</p>
						</div>
					</div>

					{/* Bookmarks */}
					<div className="flex gap-2">
						{mockBookmarks.map((link, i) => (
							<a
								key={i}
								href={link.url}
								target="_blank"
								rel="noreferrer"
								title={link.name}
								className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/20 transition-all border border-white/10 group"
							>
								<span className="font-bold text-xs group-hover:scale-110 transition-transform inline-block">
									{link.icon}
								</span>
							</a>
						))}
					</div>
				</div>
			</div>

			{/* Main Center Content */}
			<div className="flex flex-col items-center justify-center pt-32 pb-10 px-6">
				<div className="text-center mb-8">
					<h1 className="text-7xl font-light tracking-tighter mb-2 drop-shadow-2xl">
						{timeString}
					</h1>
					<p className="text-lg opacity-80 font-medium">{dateString}</p>
				</div>

				{/* Search Bar */}
				<form
					onSubmit={handleSearch}
					className="w-full max-w-2xl relative group mb-12"
				>
					<div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
						<Search
							className="text-white/40 group-focus-within:text-blue-400 transition-colors"
							size={22}
						/>
					</div>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="궁금한 내용을 검색하거나 MorningBrief AI에게 물어보세요..."
						className="w-full h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full pl-14 pr-6 text-lg outline-none focus:ring-4 focus:ring-blue-500/20 focus:bg-white/15 transition-all shadow-2xl placeholder:text-white/30"
					/>
				</form>

				{/* Widgets Grid */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
					{/* Left Column: Tasks */}
					<div className="flex flex-col gap-4">
						<WidgetCard title="오늘의 할 일" icon={CheckCircle2}>
							<div className="space-y-3">
								{todo.map((t) => (
									<div key={t.id} className="flex items-center gap-3 group">
										<button
											onClick={() => toggleTodo(t.id)}
											className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${
												t.completed
													? "bg-blue-500 border-blue-500"
													: "border-white/30 hover:border-blue-400"
											}`}
										>
											{t.completed && (
												<CheckCircle2 size={12} className="text-white" />
											)}
										</button>
										<span
											className={`text-sm flex-grow ${t.completed ? "line-through opacity-40" : "opacity-90"}`}
										>
											{t.text}
										</span>
										<button
											onClick={() => deleteTodo(t.id)}
											className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
										>
											<X size={14} />
										</button>
									</div>
								))}

								{showAddTodo ? (
									<div className="flex items-center gap-2 mt-2">
										<input
											type="text"
											value={newTodoText}
											onChange={(e) => setNewTodoText(e.target.value)}
											onKeyDown={(e) => e.key === "Enter" && addTodo()}
											placeholder="할 일 입력..."
											autoFocus
											className="flex-grow bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400 placeholder:text-white/30"
										/>
										<button
											onClick={addTodo}
											className="text-blue-400 hover:text-blue-300 text-sm font-medium"
										>
											추가
										</button>
										<button
											onClick={() => {
												setShowAddTodo(false);
												setNewTodoText("");
											}}
											className="text-white/40 hover:text-white/70"
										>
											<X size={16} />
										</button>
									</div>
								) : (
									<button
										onClick={() => setShowAddTodo(true)}
										className="flex items-center gap-2 text-xs text-blue-400 mt-4 hover:underline"
									>
										<Plus size={14} /> 새 할 일 추가
									</button>
								)}
							</div>
						</WidgetCard>
					</div>

					{/* Middle Column: Daily Digest Preview */}
					<div className="flex flex-col gap-4">
						<div className="bg-gradient-to-br from-blue-600/40 to-indigo-600/40 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl text-white flex flex-col items-center text-center">
							<p className="text-xs uppercase tracking-widest opacity-70 mb-2">
								Morning Digest
							</p>
							<h2 className="text-xl font-bold mb-2">
								{briefing ? briefing.summary : "브리핑을 불러오는 중..."}
							</h2>
							{briefing && (
								<p className="text-xs opacity-60 mb-4 leading-relaxed">
									{briefing.detail}
								</p>
							)}
							<button className="bg-white text-blue-900 px-6 py-2.5 rounded-full font-bold text-sm hover:bg-blue-50 transition-colors flex items-center gap-2">
								브리핑 듣기 <ExternalLink size={16} />
							</button>
						</div>

						<WidgetCard title="실시간 트렌드" icon={TrendingUp}>
							<div className="flex flex-wrap gap-2">
								{trends.map((tag, i) => (
									<span
										key={i}
										className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
									>
										{tag}
									</span>
								))}
							</div>
						</WidgetCard>
					</div>

					{/* Right Column: Market & Weather */}
					<div className="flex flex-col gap-4">
						<div className="grid grid-cols-2 gap-4">
							{stocks.slice(0, 2).map((stock, i) => (
								<div
									key={i}
									className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4"
								>
									<div className="flex justify-between items-center mb-1">
										<span className="text-[10px] opacity-60">{stock.name}</span>
										<span
											className={`text-[10px] ${stock.up ? "text-red-400" : "text-blue-400"}`}
										>
											{stock.up ? "▲" : "▼"} {stock.change}
										</span>
									</div>
									<p className="text-lg font-bold">{stock.value}</p>
								</div>
							))}
						</div>

						{stocks.length > 2 && (
							<div className="grid grid-cols-2 gap-4">
								{stocks.slice(2, 4).map((stock, i) => (
									<div
										key={i}
										className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4"
									>
										<div className="flex justify-between items-center mb-1">
											<span className="text-[10px] opacity-60">
												{stock.name}
											</span>
											<span
												className={`text-[10px] ${stock.up ? "text-red-400" : "text-blue-400"}`}
											>
												{stock.up ? "▲" : "▼"} {stock.change}
											</span>
										</div>
										<p className="text-lg font-bold">{stock.value}</p>
									</div>
								))}
							</div>
						)}

						<WidgetCard title="현재 날씨" icon={Sun}>
							{weather ? (
								<div className="flex items-center justify-between">
									<div>
										<p className="text-3xl font-bold">{weather.temp}°C</p>
										<p className="text-xs opacity-70">
											{weather.city}, {weather.condition}
										</p>
									</div>
									<div className="text-right">
										<p className="text-[10px] opacity-60">
											강수확률 {weather.precipitation}%
										</p>
										<p className="text-[10px] opacity-60">
											미세먼지 {weather.airQuality}
										</p>
										<p className="text-[10px] opacity-60">
											습도 {weather.humidity}%
										</p>
									</div>
								</div>
							) : (
								<p className="text-sm opacity-50">날씨 정보를 불러오는 중...</p>
							)}
						</WidgetCard>
					</div>
				</div>
			</div>

			{/* Bottom Settings Icon */}
			<div className="absolute bottom-6 right-6 flex gap-4">
				<button
					onClick={() => setShowSettings(!showSettings)}
					className="w-12 h-12 bg-white/5 hover:bg-white/15 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center transition-all shadow-lg group"
				>
					<Settings
						size={22}
						className="opacity-60 group-hover:rotate-45 transition-transform duration-500"
					/>
				</button>
			</div>

			{/* Settings Panel */}
			{showSettings && (
				<div className="absolute bottom-20 right-6 w-72 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 shadow-2xl text-white z-20">
					<div className="flex items-center justify-between mb-4">
						<h3 className="font-semibold text-sm">설정</h3>
						<button onClick={() => setShowSettings(false)}>
							<X size={16} className="opacity-60 hover:opacity-100" />
						</button>
					</div>
					<div className="space-y-3 text-xs">
						<div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/10 cursor-pointer">
							<span>테마 변경</span>
							<span className="opacity-50">→</span>
						</div>
						<div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/10 cursor-pointer">
							<span>위젯 관리</span>
							<span className="opacity-50">→</span>
						</div>
						<div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/10 cursor-pointer">
							<span>AI 브리핑 설정</span>
							<span className="opacity-50">→</span>
						</div>
						<div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/10 cursor-pointer">
							<span>프로필 편집</span>
							<span className="opacity-50">→</span>
						</div>
					</div>
				</div>
			)}

			{/* Background Text for Branding */}
			<div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-20 select-none pointer-events-none">
				<span className="text-sm font-bold tracking-[0.4em] uppercase">
					MorningBrief.AI
				</span>
			</div>
		</div>
	);
};

export default App;
