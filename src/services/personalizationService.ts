import { supabase } from "../lib/supabase";

const VALID_CATEGORIES = ["food", "place", "content", "shopping", "lifestyle", "mood", "interest"];
const SOURCE_WEIGHTS: Record<string, number> = { personal: 2, diary: 1 };

const todayStr = (): string => new Date().toISOString().slice(0, 10);
const yesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

interface ExtractedKeyword {
  keyword: string;
  category: string;
}

interface ScoreMapEntry {
  keyword: string;
  category: string;
  score: number;
}

/**
 * Groq Edge Function을 호출해 텍스트에서 관심 키워드 추출
 * @param {string} text - 분석할 텍스트 (Q&A 답변 or 일기)
 * @param {string} source - "personal" | "diary"
 * @returns {Array<{keyword: string, category: string}>}
 */
async function extractKeywords(text: string, source: string): Promise<ExtractedKeyword[]> {
  if (!text?.trim() || !supabase) return [];

  try {
    const { data, error } = await supabase.functions.invoke("groq", {
      body: {
        system: [
          "당신은 텍스트에서 관심 키워드를 추출하는 AI입니다.",
          "반드시 JSON 배열만 반환하세요. 다른 텍스트는 포함하지 마세요.",
        ].join("\n"),
        prompt: [
          `다음 텍스트에서 관심 키워드를 추출하세요 (출처: ${source === "personal" ? "개인 Q&A" : "일기"}):`,
          `"${text}"`,
          "",
          "규칙:",
          `- category는 반드시 다음 중 하나: ${VALID_CATEGORIES.join(", ")}`,
          "- keyword는 검색 가능한 명사 형태로 정규화 (예: '짜장면' O, '짜장면이 맛있다' X)",
          "- 무효 category나 빈 keyword는 포함하지 마세요",
          "- 최대 5개까지만 추출",
          "",
          '형식: [{"keyword": "키워드", "category": "카테고리"}, ...]',
          "키워드가 없으면 빈 배열 [] 반환",
        ].join("\n"),
        temperature: 0.2,
      },
    });

    if (error || !data?.text) return [];

    const text_ = (data.text as string).trim();
    const match = text_.match(/\[[\s\S]*\]/);
    const parsed: unknown = JSON.parse(match ? match[0] : text_);

    if (!Array.isArray(parsed)) return [];

    return (parsed as { keyword?: unknown; category?: unknown }[])
      .filter(
        (item) =>
          typeof item.keyword === "string" &&
          item.keyword?.trim() &&
          VALID_CATEGORIES.includes(item.category as string)
      )
      .map((item) => ({
        keyword: (item.keyword as string).trim(),
        category: item.category as string,
      }));
  } catch (e) {
    console.warn("[personalization] extractKeywords failed:", (e as Error)?.message);
    return [];
  }
}

/**
 * 30일 윈도우 가중치 계산
 * score = base_weight * (30 - elapsed_days) / 30
 */
function calcDecayedScore(baseWeight: number, loggedDate: string): number {
  const elapsed = Math.floor(
    (Date.now() - new Date(loggedDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (elapsed >= 30) return 0;
  return baseWeight * ((30 - elapsed) / 30);
}

/**
 * keyword_score_log에서 최근 30일 데이터를 읽어 집계
 * @param {string} userId
 * @returns {Array<{keyword, category, score}>} score 내림차순
 */
async function aggregateScores(userId: string): Promise<ScoreMapEntry[]> {
  if (!supabase) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("keyword_score_log")
    .select("keyword, category, base_weight, logged_date")
    .eq("user_id", userId)
    .gte("logged_date", cutoffStr);

  if (error || !data?.length) return [];

  const map: Record<string, ScoreMapEntry> = {};
  for (const row of data as { keyword: string; category: string; base_weight: number; logged_date: string }[]) {
    const score = calcDecayedScore(row.base_weight, row.logged_date);
    if (score <= 0) continue;
    const key = `${row.keyword}::${row.category}`;
    if (!map[key]) map[key] = { keyword: row.keyword, category: row.category, score: 0 };
    map[key].score += score;
  }

  return Object.values(map)
    .sort((a, b) => b.score - a.score)
    .map((item) => ({ ...item, score: Math.round(item.score * 1000) / 1000 }));
}

/**
 * 로그인 시 실행되는 개인화 배치
 * - 오늘 이미 실행됐으면 스킵
 * - 어제의 Q&A + 일기에서 키워드 추출
 * - keyword_score_log에 INSERT
 * - user_settings.keyword_interests 업데이트
 * - 30일 초과 로그 삭제
 */
export async function runPersonalizationBatch(): Promise<ScoreMapEntry[] | undefined> {
  if (!supabase) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 오늘 이미 실행됐는지 확인
    const { data: settings } = await supabase
      .from("user_settings")
      .select("keyword_interests_updated")
      .eq("id", user.id)
      .single();

    if ((settings as { keyword_interests_updated?: string } | null)?.keyword_interests_updated === todayStr()) return;

    const yesterday = yesterdayStr();

    // 어제 Q&A 답변 (user_qa 테이블)
    const { data: qaRows } = await supabase
      .from("user_qa")
      .select("question, answer")
      .eq("user_id", user.id)
      .eq("asked_date", yesterday);

    // 어제 일기 텍스트 (diaries 테이블)
    const { data: diary } = await supabase
      .from("diaries")
      .select("ai_generated_diary, edited_diary")
      .eq("user_id", user.id)
      .eq("date", yesterday)
      .maybeSingle();
    const diaryRow = diary as { ai_generated_diary?: string | null; edited_diary?: string | null } | null;
    const yesterdayDiaryText = diaryRow?.edited_diary || diaryRow?.ai_generated_diary || "";

    const newLogRows: {
      user_id: string;
      keyword: string;
      category: string;
      source: string;
      base_weight: number;
      logged_date: string;
    }[] = [];

    // Q&A 처리 (source=personal, weight=2) — 질문+답변 합산 텍스트로 추출
    if (Array.isArray(qaRows) && qaRows.length > 0) {
      const combinedQA = (qaRows as { question: string; answer: string }[])
        .map((r) => `Q: ${r.question} A: ${r.answer}`)
        .join(" ");
      const keywords = await extractKeywords(combinedQA, "personal");
      for (const { keyword, category } of keywords) {
        newLogRows.push({
          user_id: user.id,
          keyword,
          category,
          source: "personal",
          base_weight: SOURCE_WEIGHTS.personal,
          logged_date: yesterday,
        });
      }
    }

    // 일기 텍스트 처리 (source=diary, weight=1)
    if (yesterdayDiaryText.trim()) {
      const keywords = await extractKeywords(yesterdayDiaryText, "diary");
      for (const { keyword, category } of keywords) {
        newLogRows.push({
          user_id: user.id,
          keyword,
          category,
          source: "diary",
          base_weight: SOURCE_WEIGHTS.diary,
          logged_date: yesterday,
        });
      }
    }

    // 새 로그가 있으면 INSERT
    if (newLogRows.length > 0) {
      await supabase.from("keyword_score_log").insert(newLogRows);
    }

    // 30일 초과 로그 삭제
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    await supabase
      .from("keyword_score_log")
      .delete()
      .eq("user_id", user.id)
      .lt("logged_date", cutoff.toISOString().slice(0, 10));

    // 전체 30일 점수 집계 → user_settings 업데이트
    const interests = await aggregateScores(user.id);
    await supabase.from("user_settings").upsert({
      id: user.id,
      keyword_interests: interests,
      keyword_interests_updated: todayStr(),
    });

    return interests;
  } catch (e) {
    console.warn("[personalization] batch failed:", (e as Error)?.message);
  }
}
