import { supabase } from "../lib/supabase";

const VALID_CATEGORIES = ["food", "place", "content", "shopping", "lifestyle", "mood", "interest"];
const SOURCE_WEIGHTS = { personal: 2, diary: 1 };

const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Groq Edge Function을 호출해 텍스트에서 관심 키워드 추출
 * @param {string} text - 분석할 텍스트 (Q&A 답변 or 일기)
 * @param {string} source - "personal" | "diary"
 * @returns {Array<{keyword: string, category: string}>}
 */
async function extractKeywords(text, source) {
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

    const text_ = data.text.trim();
    const match = text_.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : text_);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item) =>
        item.keyword?.trim() &&
        VALID_CATEGORIES.includes(item.category)
    ).map((item) => ({
      keyword: item.keyword.trim(),
      category: item.category,
    }));
  } catch (e) {
    console.warn("[personalization] extractKeywords failed:", e?.message);
    return [];
  }
}

/**
 * 30일 윈도우 가중치 계산
 * score = base_weight * (30 - elapsed_days) / 30
 */
function calcDecayedScore(baseWeight, loggedDate) {
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
async function aggregateScores(userId) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("keyword_score_log")
    .select("keyword, category, base_weight, logged_date")
    .eq("user_id", userId)
    .gte("logged_date", cutoffStr);

  if (error || !data?.length) return [];

  const map = {};
  for (const row of data) {
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
export async function runPersonalizationBatch() {
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

    if (settings?.keyword_interests_updated === todayStr()) return;

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
      .select("diary_text")
      .eq("user_id", user.id)
      .eq("date", yesterday)
      .single();

    const newLogRows = [];

    // Q&A 처리 (source=personal, weight=2) — 질문+답변 합산 텍스트로 추출
    if (Array.isArray(qaRows) && qaRows.length > 0) {
      const combinedQA = qaRows
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
    if (diary?.diary_text?.trim()) {
      const keywords = await extractKeywords(diary.diary_text, "diary");
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
    console.warn("[personalization] batch failed:", e?.message);
  }
}

/**
 * 관심 키워드 상위 N개 반환 (전체 카테고리)
 */
export function getTopKeywords(interests, n = 10) {
  if (!Array.isArray(interests)) return [];
  return interests.slice(0, n).map((item) => item.keyword);
}

/**
 * 특정 카테고리의 상위 키워드 반환
 */
export function getTopKeywordsByCategory(interests, category, n = 5) {
  if (!Array.isArray(interests)) return [];
  return interests
    .filter((item) => item.category === category)
    .slice(0, n)
    .map((item) => item.keyword);
}

/**
 * 수동으로 keyword_interests를 DB + store에 저장 (설정 패널용)
 */
export async function saveKeywordInterests(userId, interests) {
  if (!supabase || !userId) return;
  await supabase.from("user_settings").upsert({
    id: userId,
    keyword_interests: interests,
  });
}
