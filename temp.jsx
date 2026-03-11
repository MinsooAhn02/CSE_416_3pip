import React, { useState, useEffect } from 'react';
import { 
  Search, Settings, Sun, TrendingUp, CheckCircle2, 
  ExternalLink, User, Plus, MoreVertical, 
  Globe, Instagram, Facebook, LineChart
} from 'lucide-react';

const App = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todo, setTodo] = useState([
    { id: 1, text: "CSE 416 프로젝트 회의", completed: false },
    { id: 2, text: "시스템 아키텍처 설계 초안 작성", completed: true },
    { id: 3, text: "Gemini API 연결 테스트", completed: false },
  ]);

  // 시계 업데이트
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  const dateString = currentTime.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  const WidgetCard = ({ title, icon: Icon, children }) => (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-xl text-white mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} className="text-blue-300" />}
          <h3 className="font-semibold text-sm opacity-90">{title}</h3>
        </div>
        <MoreVertical size={14} className="opacity-50 cursor-pointer" />
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
              <p className="font-bold text-sm tracking-tight">MorningBrief.AI User</p>
            </div>
          </div>
          
          {/* Bookmarks */}
          <div className="flex gap-2">
            {[
              { name: 'Google', icon: Globe, url: 'https://google.com' },
              { name: 'Naver', icon: 'N', url: 'https://naver.com' },
              { name: 'Insta', icon: Instagram, url: 'https://instagram.com' },
              { name: 'FB', icon: Facebook, url: 'https://facebook.com' }
            ].map((link, i) => (``
              <a 
                key={i}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/20 transition-all border border-white/10 group"
              >
                {typeof link.icon === 'string' ? (
                  <span className="font-bold text-lg">{link.icon}</span>
                ) : (
                  <link.icon size={18} className="group-hover:scale-110 transition-transform" />
                )}
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
        <div className="w-full max-w-2xl relative group mb-12">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="text-white/40 group-focus-within:text-blue-400 transition-colors" size={22} />
          </div>
          <input 
            type="text" 
            placeholder="궁금한 내용을 검색하거나 MorningBrief AI에게 물어보세요..."
            className="w-full h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full pl-14 pr-6 text-lg outline-none focus:ring-4 focus:ring-blue-500/20 focus:bg-white/15 transition-all shadow-2xl placeholder:text-white/30"
          />
        </div>

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
          
          {/* Left Column: Tasks */}
          <div className="flex flex-col gap-4">
            <WidgetCard title="오늘의 할 일" icon={CheckCircle2}>
              <div className="space-y-3">
                {todo.map(t => (
                  <div key={t.id} className="flex items-center gap-3 group cursor-pointer">
                    <div className={`w-5 h-5 rounded-md border ${t.completed ? 'bg-blue-500 border-blue-500' : 'border-white/30'} flex items-center justify-center`}>
                      {t.completed && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <span className={`text-sm ${t.completed ? 'line-through opacity-40' : 'opacity-90'}`}>
                      {t.text}
                    </span>
                  </div>
                ))}
                <button className="flex items-center gap-2 text-xs text-blue-400 mt-4 hover:underline">
                  <Plus size={14} /> 새 할 일 추가
                </button>
              </div>
            </WidgetCard>
          </div>

          {/* Middle Column: Daily Digest Preview */}
          <div className="flex flex-col gap-4">
            <div className="bg-gradient-to-br from-blue-600/40 to-indigo-600/40 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl text-white flex flex-col items-center text-center">
              <p className="text-xs uppercase tracking-widest opacity-70 mb-2">Morning Digest</p>
              <h2 className="text-xl font-bold mb-4">오늘의 AI 브리핑이 준비되었습니다.</h2>
              <button className="bg-white text-blue-900 px-6 py-2.5 rounded-full font-bold text-sm hover:bg-blue-50 transition-colors flex items-center gap-2">
                브리핑 듣기 <ExternalLink size={16} />
              </button>
            </div>
            
            <WidgetCard title="실시간 트렌드" icon={TrendingUp}>
              <div className="flex flex-wrap gap-2">
                {['#엔비디아_실적', '#벚꽃_개화시기', '#금리동결', '#GPT-5_루머', '#신상_맛집'].map((tag, i) => (
                  <span key={i} className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer">
                    {tag}
                  </span>
                ))}
              </div>
            </WidgetCard>
          </div>

          {/* Right Column: Market & Weather */}
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] opacity-60">KOSPI</span>
                  <span className="text-[10px] text-red-400">▲ 0.42%</span>
                </div>
                <p className="text-lg font-bold">2,754.89</p>
              </div>
              <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] opacity-60">NASDAQ</span>
                  <span className="text-[10px] text-blue-400">▼ 0.12%</span>
                </div>
                <p className="text-lg font-bold">16,384.47</p>
              </div>
            </div>

            <WidgetCard title="현재 날씨" icon={Sun}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">18°C</p>
                  <p className="text-xs opacity-70">서울, 맑음</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] opacity-60">강수확률 0%</p>
                  <p className="text-[10px] opacity-60">미세먼지 좋음</p>
                </div>
              </div>
            </WidgetCard>
          </div>

        </div>
      </div>

      {/* Bottom Settings Icon */}
      <div className="absolute bottom-6 right-6 flex gap-4">
        <button className="w-12 h-12 bg-white/5 hover:bg-white/15 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center transition-all shadow-lg group">
          <Settings size={22} className="opacity-60 group-hover:rotate-45 transition-transform duration-500" />
        </button>
      </div>

      {/* Background Text for Branding */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-20 select-none pointer-events-none">
        <span className="text-sm font-bold tracking-[0.4em] uppercase">MorningBrief.AI</span>
      </div>
    </div>
  );
};

export default App;