// src/telegram/mistakeStore.ts
import fs from "fs";
import path from "path";
import os from "os";
var TMP_FILE = path.join(os.tmpdir(), "cgl_quiz_mistakes.json");
var userMistakesMap = /* @__PURE__ */ new Map();
function normalizeUserId(rawId) {
  if (typeof rawId === "number" && !isNaN(rawId)) return rawId;
  if (!rawId) return 0;
  const num = Number(rawId);
  if (!isNaN(num)) return num;
  return 0;
}
function saveToDisk() {
  try {
    const serialized = {};
    for (const [userId, map] of userMistakesMap.entries()) {
      const uidKey = String(normalizeUserId(userId));
      if (!serialized[uidKey]) serialized[uidKey] = [];
      serialized[uidKey].push(...Array.from(map.values()));
    }
    fs.writeFileSync(TMP_FILE, JSON.stringify(serialized, null, 2), "utf8");
  } catch (err) {
    console.error("[MistakeStore] Error saving quiz mistakes to disk:", err);
  }
}
function loadFromDisk() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const raw = fs.readFileSync(TMP_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [userIdStr, list] of Object.entries(parsed)) {
          if (!Array.isArray(list)) continue;
          const uid = normalizeUserId(userIdStr);
          let map = userMistakesMap.get(uid);
          if (!map) {
            map = /* @__PURE__ */ new Map();
            userMistakesMap.set(uid, map);
          }
          for (const item of list) {
            if (item && item.id) {
              map.set(item.id, item);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[MistakeStore] Error loading quiz mistakes from disk:", err);
  }
}
loadFromDisk();
var DELETED_FILE = path.join(os.tmpdir(), "cgl_deleted_mistakes.json");
var deletedQuestionsSet = /* @__PURE__ */ new Set();
function loadDeletedFromDisk() {
  try {
    if (fs.existsSync(DELETED_FILE)) {
      const raw = fs.readFileSync(DELETED_FILE, "utf8");
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((id) => deletedQuestionsSet.add(String(id)));
      }
    }
  } catch (err) {
    console.error("[MistakeStore] Error loading deleted mistakes:", err);
  }
}
function saveDeletedToDisk() {
  try {
    fs.writeFileSync(DELETED_FILE, JSON.stringify(Array.from(deletedQuestionsSet)), "utf8");
  } catch (err) {
    console.error("[MistakeStore] Error saving deleted mistakes:", err);
  }
}
loadDeletedFromDisk();
function isQuestionDeleted(questionId, questionText) {
  if (deletedQuestionsSet.has(questionId)) return true;
  if (questionText && deletedQuestionsSet.has(questionText.trim().toLowerCase())) return true;
  return false;
}
function syncDeletedQuestions(ids) {
  let changed = false;
  for (const id of ids) {
    if (id && !deletedQuestionsSet.has(id)) {
      deletedQuestionsSet.add(id);
      changed = true;
    }
  }
  if (changed) saveDeletedToDisk();
}
function getDeletedQuestionIds() {
  return Array.from(deletedQuestionsSet);
}
function classifySubjectAndTopic(q) {
  const text = `${q.question} ${q.explanation || ""} ${q.subject || ""} ${q.topic || ""} ${q.source || ""}`.toLowerCase();
  let subject = "general_awareness";
  const subStr = (q.subject || "").toLowerCase();
  if (subStr.includes("eng") || text.includes("synonym") || text.includes("antonym") || text.includes("idiom") || text.includes("one word") || text.includes("sentence") || text.includes("misspelt")) {
    subject = "english";
  } else if (subStr.includes("math") || subStr.includes("calc") || subStr.includes("quant") || text.includes("calculate") || text.includes("triplet") || text.includes("ratio") || text.includes("circumference")) {
    subject = "mathematics";
  } else if (subStr.includes("reason") || text.includes("syllogism") || text.includes("analogy") || text.includes("blood relation") || text.includes("coding-decoding")) {
    subject = "reasoning";
  }
  let topic = q.topic && !["error bank", "general practice", "quiz practice"].includes(q.topic.trim().toLowerCase()) ? q.topic.trim() : "General Practice";
  let topicSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (topic === "General Practice") {
    if (subject === "english") {
      if (text.includes("synonym")) {
        topic = "Synonyms";
        topicSlug = "syn";
      } else if (text.includes("antonym")) {
        topic = "Antonyms";
        topicSlug = "ant";
      } else if (text.includes("one word") || text.includes("ows")) {
        topic = "One Word Substitution";
        topicSlug = "ows";
      } else if (text.includes("idiom") || text.includes("phrase")) {
        topic = "Idioms & Phrases";
        topicSlug = "idiom";
      } else if (text.includes("spelling") || text.includes("misspelt")) {
        topic = "Spelling Errors";
        topicSlug = "spell";
      } else if (text.includes("spotting") || text.includes("grammatical error")) {
        topic = "Spotting Errors";
        topicSlug = "error";
      } else if (text.includes("voice")) {
        topic = "Active & Passive Voice";
        topicSlug = "voice";
      } else if (text.includes("narration") || text.includes("direct")) {
        topic = "Direct & Indirect Speech";
        topicSlug = "narration";
      } else if (text.includes("pqrs") || text.includes("jumble")) {
        topic = "Para Jumbles";
        topicSlug = "pqrs";
      } else if (text.includes("cloze") || text.includes("comprehension")) {
        topic = "Cloze & Comprehension";
        topicSlug = "cloze";
      } else {
        topic = "Vocabulary & Grammar";
        topicSlug = "vocab";
      }
    } else if (subject === "mathematics") {
      if (text.includes("algebra")) {
        topic = "Algebra";
        topicSlug = "algebra";
      } else if (text.includes("trig")) {
        topic = "Trigonometry";
        topicSlug = "trigo";
      } else if (text.includes("geom") || text.includes("circle")) {
        topic = "Geometry";
        topicSlug = "geom";
      } else if (text.includes("mensur")) {
        topic = "Mensuration";
        topicSlug = "mens";
      } else if (text.includes("number") || text.includes("remainder")) {
        topic = "Number System";
        topicSlug = "num";
      } else if (text.includes("profit") || text.includes("loss")) {
        topic = "Profit & Loss";
        topicSlug = "pnl";
      } else if (text.includes("percent")) {
        topic = "Percentages";
        topicSlug = "pct";
      } else if (text.includes("ratio")) {
        topic = "Ratio & Proportion";
        topicSlug = "ratio";
      } else if (text.includes("interest")) {
        topic = "SI & CI";
        topicSlug = "si_ci";
      } else if (text.includes("work") || text.includes("pipe")) {
        topic = "Time & Work";
        topicSlug = "work";
      } else if (text.includes("speed") || text.includes("train")) {
        topic = "Speed, Time & Distance";
        topicSlug = "speed";
      } else {
        topic = "Arithmetic";
        topicSlug = "arith";
      }
    } else if (subject === "reasoning") {
      if (text.includes("syllogism")) {
        topic = "Syllogism";
        topicSlug = "syl";
      } else if (text.includes("analogy")) {
        topic = "Analogy";
        topicSlug = "analogy";
      } else if (text.includes("coding")) {
        topic = "Coding & Decoding";
        topicSlug = "coding";
      } else if (text.includes("series")) {
        topic = "Series";
        topicSlug = "series";
      } else if (text.includes("blood")) {
        topic = "Blood Relations";
        topicSlug = "blood";
      } else if (text.includes("direction")) {
        topic = "Direction Sense";
        topicSlug = "direction";
      } else if (text.includes("venn")) {
        topic = "Venn Diagrams";
        topicSlug = "venn";
      } else {
        topic = "General Reasoning";
        topicSlug = "reason_gen";
      }
    } else {
      if (text.includes("polity") || text.includes("article") || text.includes("constitution")) {
        topic = "Polity & Constitution";
        topicSlug = "polity";
      } else if (text.includes("history")) {
        topic = "Indian History";
        topicSlug = "history";
      } else if (text.includes("geo") || text.includes("river")) {
        topic = "Geography";
        topicSlug = "geo";
      } else if (text.includes("eco") || text.includes("budget")) {
        topic = "Economics";
        topicSlug = "eco";
      } else if (text.includes("bio") || text.includes("disease")) {
        topic = "Biology";
        topicSlug = "bio";
      } else if (text.includes("phys")) {
        topic = "Physics";
        topicSlug = "phys";
      } else if (text.includes("chem")) {
        topic = "Chemistry";
        topicSlug = "chem";
      } else {
        topic = "General Awareness & Static GK";
        topicSlug = "gk_static";
      }
    }
  }
  return { subject, topic, topicSlug };
}
function recordMistake(rawUserId, q, source = "telegram_quiz", isCorrect = false) {
  if (isQuestionDeleted(q.id, q.question)) return;
  const userId = normalizeUserId(rawUserId);
  let userMap = userMistakesMap.get(userId);
  if (!userMap) {
    userMap = /* @__PURE__ */ new Map();
    userMistakesMap.set(userId, userMap);
  }
  let existing = userMap.get(q.id);
  if (!existing && q.question) {
    const qNorm = q.question.trim().toLowerCase().replace(/\s+/g, " ");
    for (const m of userMap.values()) {
      if (m.question && m.question.trim().toLowerCase().replace(/\s+/g, " ") === qNorm) {
        existing = m;
        break;
      }
    }
  }
  if (isCorrect) {
    if (existing) {
      existing.mastered = true;
      saveToDisk();
    }
    return;
  }
  const { subject, topic, topicSlug } = classifySubjectAndTopic(q);
  const correctIdx = typeof q.correctOptionIndex === "number" ? q.correctOptionIndex : 0;
  if (existing) {
    existing.wrongCount = (existing.wrongCount || 1) + 1;
    existing.mastered = false;
    existing.timestamp = Date.now();
  } else {
    const mistake = {
      id: q.id,
      userId,
      question: q.question,
      options: q.options,
      correctOptionIndex: correctIdx,
      explanation: q.fullSolution || q.explanation || "",
      subject,
      topic,
      topicSlug,
      source,
      timestamp: Date.now(),
      wrongCount: 1,
      mastered: false
    };
    userMap.set(q.id, mistake);
  }
  saveToDisk();
}
function deleteMistake(rawUserId, questionId, questionText) {
  if (questionId) deletedQuestionsSet.add(questionId);
  if (questionText) deletedQuestionsSet.add(questionText.trim().toLowerCase());
  saveDeletedToDisk();
  for (const map of userMistakesMap.values()) {
    map.delete(questionId);
    if (questionText) {
      const clean = questionText.trim().toLowerCase();
      for (const [key, val] of map.entries()) {
        if (val.question.trim().toLowerCase() === clean) {
          map.delete(key);
        }
      }
    }
  }
  saveToDisk();
}
function getAllRecordedMistakes(filter = "all", subject, topicSlug) {
  const results = [];
  const seenKeys = /* @__PURE__ */ new Set();
  for (const map of userMistakesMap.values()) {
    for (const item of map.values()) {
      if (isQuestionDeleted(item.id, item.question)) continue;
      if (filter !== "all" && item.source !== filter) continue;
      if (subject && item.subject !== subject) continue;
      if (topicSlug && topicSlug !== "_" && item.topicSlug !== topicSlug) continue;
      const qKey = (item.question || "").trim().toLowerCase().replace(/[\s\u200B-\u200D\uFEFF]+/g, " ").replace(/[?.!,:;'"()\[\]{}]+$/g, "") || item.id;
      if (seenKeys.has(qKey)) continue;
      seenKeys.add(qKey);
      results.push(item);
    }
  }
  return results.sort((a, b) => b.timestamp - a.timestamp);
}
function clearAllMistakes(userId) {
  if (userId !== void 0 && userId !== 0) {
    userMistakesMap.delete(userId);
  } else {
    userMistakesMap.clear();
  }
  saveToDisk();
}
function getMistakeStats(rawUserId, filter = "all") {
  const userId = normalizeUserId(rawUserId);
  const subjects = [
    { id: "english", shortCode: "eng", title: "\u{1F4D6} English" },
    { id: "mathematics", shortCode: "math", title: "\u{1F4D0} Mathematics" },
    { id: "reasoning", shortCode: "reas", title: "\u{1F9E0} Reasoning" },
    { id: "general_awareness", shortCode: "ga", title: "\u{1F3DB}\uFE0F General Awareness" }
  ];
  return subjects.map((sub) => {
    const topicMap = /* @__PURE__ */ new Map();
    let total = 0;
    const seenQIds = /* @__PURE__ */ new Set();
    const processItem = (item) => {
      if (isQuestionDeleted(item.id, item.question)) return;
      if (filter !== "all" && item.source !== filter) return;
      if (item.subject !== sub.id) return;
      if (seenQIds.has(item.id)) return;
      seenQIds.add(item.id);
      total++;
      const existing = topicMap.get(item.topicSlug) || {
        topic: item.topic,
        slug: item.topicSlug,
        count: 0
      };
      existing.count++;
      topicMap.set(item.topicSlug, existing);
    };
    const userMap = userMistakesMap.get(userId);
    if (userMap) {
      for (const item of userMap.values()) {
        processItem(item);
      }
    }
    if (userId !== 0) {
      const guestMap = userMistakesMap.get(0);
      if (guestMap) {
        for (const item of guestMap.values()) {
          processItem(item);
        }
      }
    }
    const topics = Array.from(topicMap.values()).sort((a, b) => b.count - a.count);
    return {
      subjectId: sub.id,
      shortCode: sub.shortCode,
      title: sub.title,
      total,
      topics
    };
  });
}
function getTotalMistakesSummary(rawUserId) {
  const userId = normalizeUserId(rawUserId);
  const allStats = getMistakeStats(userId, "all");
  const tgStats = getMistakeStats(userId, "telegram_quiz");
  const webStats = getMistakeStats(userId, "website_quiz");
  return {
    all: allStats.reduce((acc, s) => acc + s.total, 0),
    telegram_quiz: tgStats.reduce((acc, s) => acc + s.total, 0),
    website_quiz: webStats.reduce((acc, s) => acc + s.total, 0)
  };
}

// src/telegram/mistakesApi.ts
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method === "GET") {
    try {
      const { filter = "all", subject, topicSlug, userId } = req.query || {};
      const numUserId = normalizeUserId(userId);
      const mistakes = getAllRecordedMistakes(filter, subject, topicSlug);
      const stats = getMistakeStats(numUserId, filter);
      const summary = getTotalMistakesSummary(numUserId);
      const deletedIds = getDeletedQuestionIds();
      return res.status(200).json({
        success: true,
        summary,
        stats,
        mistakes,
        deletedIds,
        total: mistakes.length
      });
    } catch (err) {
      console.error("[api/mistakes GET] Error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  }
  if (req.method === "POST") {
    try {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
        }
      }
      const { action, questionId, questionText, userId, ids, questionData } = body && typeof body === "object" ? body : {};
      if (action === "record") {
        if (!questionData || !questionData.question) {
          return res.status(400).json({ error: "questionData is required" });
        }
        let opts = [];
        if (Array.isArray(questionData.options)) {
          opts = questionData.options.map(String);
        } else if (questionData.options && typeof questionData.options === "object") {
          opts = Object.values(questionData.options).map(String);
        }
        let correctOpt = String(questionData.correctOption || questionData.answer || "");
        if (["a", "b", "c", "d"].includes(correctOpt.toLowerCase())) {
          const idx = ["a", "b", "c", "d"].indexOf(correctOpt.toLowerCase());
          if (opts[idx]) {
            correctOpt = opts[idx];
          }
        }
        const correctIndex = opts.indexOf(correctOpt) >= 0 ? opts.indexOf(correctOpt) : 0;
        recordMistake(
          normalizeUserId(userId),
          {
            id: String(questionData.id || `web_quiz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
            question: questionData.question,
            options: opts,
            correctOptionIndex: correctIndex,
            explanation: questionData.explanation || questionData.solution || "",
            subject: questionData.subject || "general_awareness",
            topic: questionData.topic || questionData.subtopic || "Quiz Practice",
            source: questionData.isMock ? "\u{1F4BB} Website Mock Mistake" : "\u{1F4BB} Website Quiz Mistake"
          },
          questionData.isMock ? "website_mock" : "website_quiz",
          false
        );
        return res.status(200).json({
          success: true,
          message: "Quiz mistake recorded successfully."
        });
      }
      if (action === "delete") {
        if (!questionId && !questionText) {
          return res.status(400).json({ error: "questionId or questionText is required" });
        }
        deleteMistake(userId ? Number(userId) : void 0, questionId, questionText);
        return res.status(200).json({
          success: true,
          message: "Question deleted from mistake bank.",
          deletedQuestionId: questionId
        });
      }
      if (action === "sync_deleted") {
        if (Array.isArray(ids)) {
          syncDeletedQuestions(ids);
          return res.status(200).json({
            success: true,
            syncedCount: ids.length
          });
        }
        return res.status(400).json({ error: "ids array required for sync_deleted" });
      }
      if (action === "clear_all") {
        clearAllMistakes(userId ? normalizeUserId(userId) : void 0);
        return res.status(200).json({
          success: true,
          message: "All recorded mistakes cleared successfully."
        });
      }
      return res.status(400).json({ error: "Unknown action" });
    } catch (err) {
      console.error("[api/mistakes POST] Error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  }
  return res.status(405).json({ error: "Method Not Allowed" });
}
export {
  handler as default
};
