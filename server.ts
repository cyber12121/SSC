import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import { cleanSolutionText } from "./src/utils/cleanSolution";

dotenv.config();

// Generate deterministic unique question ID from subject and question content
function generateQuestionId(subject: string, questionText: string): string {
  const clean = questionText.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hash = crypto.createHash("md5").update(clean).digest("hex").slice(0, 10);
  const subPrefix = subject.slice(0, 4).toLowerCase();
  return `${subPrefix}_${hash}`;
}

// Subject standardizer
function normalizeSubject(raw: string): { name: string; file: string } {
  if (/quant|math|aptitude/i.test(raw)) return { name: "Mathematics", file: "mathematics.json" };
  if (/reason|intel/i.test(raw)) return { name: "Reasoning", file: "reasoning.json" };
  if (/eng/i.test(raw)) return { name: "English", file: "english.json" };
  if (/aware|gk|gs|ga|knowledge/i.test(raw)) return { name: "General Awareness", file: "general_awareness.json" };
  return { name: "Mathematics", file: "mathematics.json" };
}

// Fast Rule-Based SSC Topic Matcher (instant local fallback)
function getLocalTopicTag(subject: string, text: string, currentTopic?: string): string {
  if (currentTopic && currentTopic !== "General" && currentTopic !== "Unknown") {
    return currentTopic;
  }

  const s = text.toLowerCase();

  if (/mathematics|quant/i.test(subject)) {
    if (/\b(sin|cos|tan|cot|sec|cosec|trigonometr|height and distance)\b/i.test(s)) return "Trigonometry";
    if (/\b(triangle|circle|chord|tangent|rhombus|parallelogram|trapezium|centroid|orthocenter|circumcenter)\b/i.test(s)) return "Geometry";
    if (/\b(x\s*[\+\-\*\/]|polynomial|quadratic|x\^2|a\^3\s*\+\s*b\^3|linear equation|identity)\b/i.test(s)) return "Algebra";
    if (/\b(cone|cylinder|sphere|hemisphere|cuboid|cube|frustum|surface area|volume of)\b/i.test(s)) return "Mensuration";
    if (/\b(work|pipes?|cistern|efficiency|alternate days?)\b/i.test(s)) return "Time & Work";
    if (/\b(train|speed|downstream|upstream|boat|km\/h|relative speed|race)\b/i.test(s)) return "Speed Time & Distance";
    if (/\b(compound interest|simple interest|compounded|per annum is ₹|sum becomes \d+ times)\b/i.test(s)) return "Simple & Compound Interest";
    if (/\b(marked price|cost price|selling price|discount|gain percentage|loss percentage|profit)\b/i.test(s)) return "Profit & Loss";
    if (/\b(percent|percentage|increased by \d+%|decreased by \d+%)\b/i.test(s)) return "Percentage";
    if (/\b(ratio|proportion|fourth proportional|mean proportional)\b/i.test(s)) return "Ratio & Proportion";
    if (/\b(average|mean of|average score|average age)\b/i.test(s)) return "Average";
    if (/\b(divisible|remainder|hcf|lcm|prime number|unit digit)\b/i.test(s)) return "Number System";
    if (/\b(bar graph|pie chart|table shows|histogram|line graph)\b/i.test(s)) return "Data Interpretation";
    return "Arithmetic";
  }

  if (/reasoning/i.test(subject)) {
    if (/\b(statements?:|conclusions?:|all\s+\w+\s+are|some\s+\w+\s+are|no\s+\w+\s+is)\b/i.test(s)) return "Syllogism";
    if (/\b(mother|father|brother|sister|son|daughter|uncle|aunt|nephew|niece|husband|wife|photograph)\b/i.test(s)) return "Blood Relations";
    if (/\b(walks? \d+|turns? left|turns? right|north|south|east|west)\b/i.test(s)) return "Direction & Distance";
    if (/\b(coded as|code language)\b/i.test(s)) return "Coding-Decoding";
    if (/\b(related to the third|in the same way as|analogy)\b/i.test(s)) return "Analogy";
    if (/\b(odd one out|three of the following|does not belong)\b/i.test(s)) return "Classification";
    if (/\b(replace the question mark|series)\b/i.test(s)) return "Number Series";
    if (/\b(interchange the signs|correct equation)\b/i.test(s)) return "Mathematical Operations";
    if (/\b(dice|cube|opposite to the face)\b/i.test(s)) return "Dice & Cube";
    if (/\b(venn diagram|represents the relationship)\b/i.test(s)) return "Venn Diagram";
    if (/\b(mirror image|water image)\b/i.test(s)) return "Mirror & Water Image";
    if (/\b(paper is folded|unfolded|folding)\b/i.test(s)) return "Paper Folding";
    if (/\b(embedded|hidden figure)\b/i.test(s)) return "Embedded Figures";
    if (/\b(circular table|facing the center|linear row|seating)\b/i.test(s)) return "Seating Arrangement";
    return "General Reasoning";
  }

  if (/english/i.test(subject)) {
    if (/\b(grammatical error|spot the error|contains an error)\b/i.test(s)) return "Spotting Errors";
    if (/\b(substitute|substitution|underline|improve)\b/i.test(s)) return "Sentence Improvement";
    if (/\b(fill in the blank|blank)\b/i.test(s)) return "Fill in the Blanks";
    if (/\b(synonym|antonym|similar|opposite in meaning)\b/i.test(s)) return "Synonyms & Antonyms";
    if (/\b(idiom|phrase)\b/i.test(s)) return "Idioms & Phrases";
    if (/\b(one word substitution|group of words)\b/i.test(s)) return "One Word Substitution";
    if (/\b(passive voice|active voice)\b/i.test(s)) return "Active & Passive Voice";
    if (/\b(indirect speech|direct speech|reported speech)\b/i.test(s)) return "Direct & Indirect Speech";
    if (/\b(correctly spelt|incorrectly spelt|misspelt)\b/i.test(s)) return "Spelling Errors";
    if (/\b(cloze|passage)\b/i.test(s)) return "Cloze Test";
    if (/\b([P-S]{4}|jumbled)\b/i.test(s)) return "Para Jumbles";
    return "Grammar & Vocab";
  }

  if (/general awareness/i.test(subject)) {
    if (/\b(dynasty|mughal|maurya|gupta|delhi sultanate|harappan|indus|british|viceroy|gandhi|battle|buddhism|jainism)\b/i.test(s)) return "History";
    if (/\b(constitution|article \d+|fundamental rights|president|prime minister|parliament|lok sabha|rajya sabha|supreme court|amendment|panchayat)\b/i.test(s)) return "Polity";
    if (/\b(river|mountain|himalaya|plateau|soil|climate|monsoon|national park|ocean|strait)\b/i.test(s)) return "Geography";
    if (/\b(gdp|inflation|rbi|monetary policy|repo rate|fiscal|budget|banking)\b/i.test(s)) return "Economics";
    if (/\b(cell|photosynthesis|newton|acid|base|chemical|velocity|force|hormone|enzyme|vitamin|disease|element|atom)\b/i.test(s)) return "General Science";
    if (/\b(dance|classical dance|folk dance|festival|award|nobel|bharat ratna|temple|monument|author|stadium)\b/i.test(s)) return "Static GK";
    return "Static GK";
  }

  return "General";
}

interface AIEnrichmentResult {
  topic: string;
  questionText?: string;
  solution?: string;
  correctOption?: string;
}

// AI Batch Classifier & Structure Refiner:
// - Classifies SSC CGL syllabus topic
// - Cleans corrupted formatting or UI artifacts from question and solution
// - Resolves "N/A" correct options by analyzing question, options, and solution
// If AI classification fails or API key is missing, throws an error and stops execution.
async function classifyAndRefineBatchWithAI(questions: any[]): Promise<AIEnrichmentResult[]> {
  const results: AIEnrichmentResult[] = new Array(questions.length).fill(null);
  const toProcessIndices: number[] = [];

  // Identify questions that need AI classification, N/A answer resolution, or structural cleanup
  questions.forEach((q, idx) => {
    const existingTopic = q.topic;
    const hasValidTopic = existingTopic && existingTopic !== "General" && existingTopic !== "Unknown";
    const hasValidAnswer = q.correctOption && q.correctOption !== "N/A" && /^[A-D]$/i.test(q.correctOption.trim());
    const hasCleanText = !(q.questionText || q.question || "").includes("Reattempt mode is Off");

    if (hasValidTopic && hasValidAnswer && hasCleanText) {
      results[idx] = {
        topic: existingTopic,
        questionText: (q.questionText || q.question || "").trim(),
        solution: (q.solution || "").trim(),
        correctOption: q.correctOption.trim().toUpperCase()
      };
    } else {
      toProcessIndices.push(idx);
    }
  });

  if (toProcessIndices.length === 0) {
    console.log(`[AI Processor] All ${questions.length} questions already complete. Skipping AI.`);
    return results;
  }

  console.log(`[AI Processor] ${questions.length - toProcessIndices.length} questions already complete. Processing ${toProcessIndices.length} questions with Gemini AI for topic tagging, structure cleanup, and N/A answer resolution...`);

  const apiKey = process.env.GEMINI_API_KEY;
  const questionsToProcess = toProcessIndices.map(i => questions[i]);

  if (!apiKey || apiKey === "your_gemini_api_key_here" || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY is missing or unconfigured in D:\\My-Project\\CGL-APP\\.env. Please provide a valid Gemini API key.");
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
  console.log(`[AI Processor] Processing ${questionsToProcess.length} questions in mini-batches with Gemini (${modelName})...`);

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const CHUNK_SIZE = 5;

    for (let c = 0; c < toProcessIndices.length; c += CHUNK_SIZE) {
      const chunkIndices = toProcessIndices.slice(c, c + CHUNK_SIZE);
      const chunkQuestions = chunkIndices.map(i => questions[i]);

      console.log(`[AI Processor] 🚀 Batch ${Math.floor(c / CHUNK_SIZE) + 1}/${Math.ceil(toProcessIndices.length / CHUNK_SIZE)} (${chunkQuestions.length} questions)...`);

      const promptText = `You are an expert SSC CGL Exam Content Refiner. Process each question carefully:

Tasks for each question:
1. "topic": Classify into its official SSC CGL main syllabus topic (e.g. Percentage, Profit & Loss, SI & CI, Time & Work, Geometry, Mensuration, Algebra, Trigonometry, Number System, Syllogism, Blood Relations, Analogy, Coding-Decoding, Seating Arrangement, Direction & Distance, Error Spotting, Cloze Test, Idioms, Synonyms & Antonyms, History, Polity, Geography, Economics, General Science, Static GK).
2. "question": Clean and format the question prompt:
   - Restore mathematical powers/exponents and superscripts (e.g., "31³ + 18³ - 37³ + 210" or "31^3 + 18^3 - 37^3 + 210", "x²" or "x^2").
   - Strip any leaked option choices that were pasted at the end of the question text.
   - Remove residual platform noise (like "Reattempt mode is Off", "Marks +2", "Report", "Save", language headers).
3. "solution": Clean up the solution explanation (remove Hindi translation headers, footer UI buttons like "Previous/Next/Review", feedback surveys). Keep equations readable.
4. "correctOption": If the provided correctOption is "N/A", unknown, or invalid, analyze the question, options, and solution to determine the true correct option letter ("A", "B", "C", or "D"). If already a valid letter ("A", "B", "C", or "D"), confirm or correct it.

CRITICAL JSON FORMAT RULE:
Ensure all double-quotes (") and backslashes (\\) inside string values are properly escaped. Do not output unescaped characters.

Questions to process:
${chunkQuestions.map((q, idx) => `[${idx}]
Subject: ${q.subject || q.section || "General"}
Current Correct Option: ${q.correctOption || "N/A"}
Question Text:
${q.questionText || q.question || ""}
Options:
A: ${q.options?.A || q.options?.a || ""}
B: ${q.options?.B || q.options?.b || ""}
C: ${q.options?.C || q.options?.c || ""}
D: ${q.options?.D || q.options?.d || ""}
Solution:
${q.solution || ""}
`).join("\n---\n")}

Return ONLY a valid JSON array of ${chunkQuestions.length} objects:
[
  {
    "topic": "Topic Name",
    "question": "Cleaned & correctly formatted question text",
    "solution": "Cleaned solution text",
    "correctOption": "A"
  }
]`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config: { responseMimeType: "application/json" }
      });

      let rawText = (response.text || "[]").trim();
      if (rawText.startsWith("```json")) rawText = rawText.slice(7);
      if (rawText.startsWith("```")) rawText = rawText.slice(3);
      if (rawText.endsWith("```")) rawText = rawText.slice(0, -3);
      rawText = rawText.trim();

      let parsed: any[];
      try {
        parsed = JSON.parse(rawText);
      } catch (parseErr: any) {
        console.error(`[AI Processor] ❌ Batch ${Math.floor(c / CHUNK_SIZE) + 1} JSON parse failed:`, parseErr.message);
        throw new Error(`AI processing failed: Invalid JSON received from Gemini on batch ${Math.floor(c / CHUNK_SIZE) + 1} (${parseErr.message}). Halting import.`);
      }

      if (!Array.isArray(parsed) || parsed.length !== chunkIndices.length) {
        throw new Error(`AI processing failed: Batch ${Math.floor(c / CHUNK_SIZE) + 1} item count mismatch (Expected ${chunkIndices.length}, got ${parsed?.length || 0}). Halting import.`);
      }

      parsed.forEach((item, idx) => {
        const originalIdx = chunkIndices[idx];
        const originalQ = questions[originalIdx];
        results[originalIdx] = {
          topic: (item.topic || "").trim(),
          questionText: (item.question || originalQ.questionText || originalQ.question || "").trim(),
          solution: (item.solution || originalQ.solution || "").trim(),
          correctOption: (item.correctOption || originalQ.correctOption || "A").toUpperCase().trim()
        };
      });
    }

    console.log(`[AI Processor] ✅ Successfully refined & classified all ${toProcessIndices.length} questions with Gemini!`);
    return results;
  } catch (err: any) {
    console.error(`[AI Processor] ❌ AI Processing failed. Halting import without saving any questions:`, err?.message || err);
    throw err;
  }
}

// Compute Mock Score & Accuracy Report
function computeMockScoreReport(rawList: any[], mockTitle?: string): any {
  const subjectGroups: Record<string, any[]> = {
    Reasoning: [],
    "General Awareness": [],
    Mathematics: [],
    English: []
  };

  rawList.forEach(q => {
    const rawSubject = q.subject || q.section || "Quantitative Aptitude";
    const { name } = normalizeSubject(rawSubject);
    if (subjectGroups[name]) {
      subjectGroups[name].push(q);
    }
  });

  const activeSubjects = Object.keys(subjectGroups).filter(k => subjectGroups[k].length > 0);
  const isFullMock = activeSubjects.length >= 2 || rawList.length >= 70;
  const mockType: "full" | "sectional" = isFullMock ? "full" : "sectional";

  const sections: Record<string, any> = {};
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnattempted = 0;
  let totalScore = 0;

  const subjectsToProcess = isFullMock ? ["Reasoning", "General Awareness", "Mathematics", "English"] : activeSubjects;

  for (const sub of subjectsToProcess) {
    const qList = subjectGroups[sub] || [];
    let wrong = 0;
    let unattempted = 0;
    let correct = 0;
    let hasExplicitCorrect = false;

    qList.forEach(q => {
      const status = (q.status || "").toLowerCase();
      if (status.includes("correct") && !status.includes("incorrect")) {
        correct++;
        hasExplicitCorrect = true;
      } else if (status.includes("wrong") || status.includes("incorrect")) {
        wrong++;
      } else if (status.includes("unattempted") || status.includes("skipped")) {
        unattempted++;
      } else {
        wrong++;
      }
    });

    const standardTotal = 25;
    if (!hasExplicitCorrect || qList.length < standardTotal) {
      correct = Math.max(0, standardTotal - wrong - unattempted);
    }

    const sectionScore = Math.round(((correct * 2) - (wrong * 0.5)) * 10) / 10;
    const attempted = correct + wrong;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0;

    totalCorrect += correct;
    totalWrong += wrong;
    totalUnattempted += unattempted;
    totalScore += sectionScore;

    const key = sub === "General Awareness" ? "generalAwareness" : sub === "Mathematics" ? "mathematics" : sub.toLowerCase();
    sections[key] = {
      total: standardTotal,
      correct,
      wrong,
      unattempted,
      score: sectionScore,
      accuracy
    };
  }

  const totalQuestions = isFullMock ? 100 : (subjectsToProcess.length * 25);
  const maxMarks = totalQuestions * 2;
  const totalAttempted = totalCorrect + totalWrong;
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 1000) / 10 : 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const title = mockTitle || (isFullMock ? `Full Mock - ${dateStr}` : `${activeSubjects[0] || "Sectional"} Mock - ${dateStr}`);

  return {
    id: "mock_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    title,
    type: mockType,
    subject: isFullMock ? undefined : (activeSubjects[0] || "General"),
    date: now.toISOString(),
    totalQuestions,
    maxMarks,
    totalScore: Math.round(totalScore * 10) / 10,
    overallAccuracy,
    totalCorrect,
    totalWrong,
    totalUnattempted,
    sections
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "SSC CGL Backend is running" });
  });

  // Automated Mock Error Import Endpoint
  app.post("/api/mock-import", async (req, res) => {
    try {
      const payload = req.body;
      let rawList: any[] = [];

      if (Array.isArray(payload)) {
        rawList = payload;
      } else if (payload && typeof payload === "object") {
        if (Array.isArray(payload.data)) rawList = payload.data;
        else if (Array.isArray(payload.questions)) rawList = payload.questions;
        else {
          // Check if it's a section map like { "General Intelligence and Reasoning": [...], "Quantitative Aptitude": [...] }
          const values = Object.values(payload);
          if (values.length > 0 && values.every(v => Array.isArray(v))) {
            rawList = values.flat();
          }
        }
      }

      if (!rawList || rawList.length === 0) {
        return res.status(400).json({ error: "No questions in payload" });
      }

      console.log(`[Mock Import] Received ${rawList.length} questions. Classifying topics & refining structure...`);

      // 1. Run AI topic classification, structure cleaning, and N/A answer resolution
      const enriched = await classifyAndRefineBatchWithAI(rawList);

      // 2. Group incoming questions by normalized subject
      const subjectMap: Record<string, any[]> = {};

      rawList.forEach((q, idx) => {
        const rawSubject = q.subject || q.section || "Quantitative Aptitude";
        const { name, file } = normalizeSubject(rawSubject);
        if (!subjectMap[file]) subjectMap[file] = [];
        subjectMap[file].push({
          raw: q,
          subjectName: name,
          enriched: enriched[idx]
        });
      });

      const resultsSummary: Record<string, number> = {};
      const mockDir = path.join(process.cwd(), "src", "data", "mock_errors");

      // 3. Update each subject file
      for (const [fileName, items] of Object.entries(subjectMap)) {
        const filePath = path.join(mockDir, fileName);
        let chapters: any[] = [];

        if (fs.existsSync(filePath)) {
          try {
            chapters = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          } catch (e) {
            chapters = [];
          }
        }

        const subjectName = items[0].subjectName;
        const subjectId = fileName.replace(".json", "");

        // Configure buckets per subject
        if (subjectName === "Mathematics" || subjectName === "Reasoning") {
          // 3 Buckets for Math & Reasoning
          if (!chapters.some(c => c.chapter_title === "Speed Issue")) {
            chapters.push({ chapter_num: 1, chapter_title: "Speed Issue", subject: subjectName, subject_id: subjectId, questions: [] });
          }
          if (!chapters.some(c => c.chapter_title === "Unattempted")) {
            chapters.push({ chapter_num: 2, chapter_title: "Unattempted", subject: subjectName, subject_id: subjectId, questions: [] });
          }
          if (!chapters.some(c => c.chapter_title === "Wrong")) {
            chapters.push({ chapter_num: 3, chapter_title: "Wrong", subject: subjectName, subject_id: subjectId, questions: [] });
          }
        } else if (subjectName === "General Awareness") {
          // 2 Buckets for GK (Unattempted & Wrong, no Speed Issue)
          // Remove any legacy Speed Issue from GK
          chapters = chapters.filter(c => c.chapter_title !== "Speed Issue");
          if (!chapters.some(c => c.chapter_title === "Unattempted")) {
            chapters.push({ chapter_num: 1, chapter_title: "Unattempted", subject: subjectName, subject_id: subjectId, questions: [] });
          }
          if (!chapters.some(c => c.chapter_title === "Wrong")) {
            chapters.push({ chapter_num: 2, chapter_title: "Wrong", subject: subjectName, subject_id: subjectId, questions: [] });
          }
        } else if (subjectName === "English") {
          // 1 Bucket for English (Mock Errors)
          // Consolidate any multiple chapters into single "Mock Errors" chapter
          const allEnglishQuestions = chapters.flatMap(c => c.questions || []);
          chapters = [{
            chapter_num: 1,
            chapter_title: "Mock Errors",
            subject: subjectName,
            subject_id: subjectId,
            questions: allEnglishQuestions
          }];
        }

        // Sort chapters
        chapters.sort((a, b) => (a.chapter_num || 0) - (b.chapter_num || 0));

        let addedCount = 0;

        for (const item of items) {
          const q = item.raw;
          const status = (q.status || "Incorrect").toLowerCase();
          let targetTitle = "Wrong";

          if (subjectName === "Mathematics" || subjectName === "Reasoning") {
            if (status.includes("slow") || status.includes("speed")) {
              targetTitle = "Speed Issue";
            } else if (status.includes("unattempted") || status.includes("skipped")) {
              targetTitle = "Unattempted";
            } else {
              targetTitle = "Wrong";
            }
          } else if (subjectName === "General Awareness") {
            // GK: 2 buckets (Unattempted or Wrong)
            if (status.includes("unattempted") || status.includes("skipped")) {
              targetTitle = "Unattempted";
            } else {
              targetTitle = "Wrong";
            }
          } else if (subjectName === "English") {
            // English: 1 bucket (Mock Errors)
            targetTitle = "Mock Errors";
          }

          let targetChapter = chapters.find(c => c.chapter_title === targetTitle);
          if (!targetChapter) {
            targetChapter = chapters[0];
          }

          const enr = item.enriched || {};
          const qText = (enr.questionText || q.questionText || q.question || "").trim();
          if (!qText) continue;

          const qId = generateQuestionId(subjectName, qText);

          // Prevent exact duplicates in the target chapter (by id or text)
          const isDuplicate = targetChapter.questions.some((existing: any) =>
            (existing.id && existing.id === qId) ||
            (existing.question && existing.question.trim().toLowerCase() === qText.toLowerCase())
          );

          if (!isDuplicate) {
            const rawAns = enr.correctOption || q.correctOption || q.answer || "a";
            const cleanAns = rawAns.toLowerCase().trim();

            const newQ = {
              id: qId,
              q_num: targetChapter.questions.length + 1,
              question: qText,
              options: {
                a: (q.options?.A || q.options?.a || "").trim(),
                b: (q.options?.B || q.options?.b || "").trim(),
                c: (q.options?.C || q.options?.c || "").trim(),
                d: (q.options?.D || q.options?.d || "").trim()
              },
              answer: cleanAns,
              solution: cleanSolutionText(enr.solution || q.solution || ""),
              tags: {
                topic: enr.topic || "General",
                difficulty: status.includes("Slow") ? "hard" : "medium"
              }
            };

            targetChapter.questions.push(newQ);
            addedCount++;
          }
        }

        fs.writeFileSync(filePath, JSON.stringify(chapters, null, 2), "utf-8");
        resultsSummary[subjectName] = addedCount;
      }

      // 4. Calculate and save Mock Score Report
      let calculatedReport = null;
      try {
        calculatedReport = computeMockScoreReport(rawList, payload.title || payload.testName || payload.name);
        const mockReportPath = path.join(process.cwd(), "src", "data", "mock_reports.json");
        let existingReports: any[] = [];
        if (fs.existsSync(mockReportPath)) {
          try {
            existingReports = JSON.parse(fs.readFileSync(mockReportPath, "utf-8"));
          } catch {
            existingReports = [];
          }
        }
        existingReports.unshift(calculatedReport);
        fs.writeFileSync(mockReportPath, JSON.stringify(existingReports, null, 2), "utf-8");
        console.log(`[Mock Import] Mock Score Report saved: ${calculatedReport.title} (Score: ${calculatedReport.totalScore}/${calculatedReport.maxMarks})`);
      } catch (repErr) {
        console.error("[Mock Import] Error generating score report:", repErr);
      }

      console.log(`[Mock Import] Success:`, resultsSummary);
      res.json({ success: true, imported: resultsSummary, scoreReport: calculatedReport });
    } catch (err: any) {
      console.error("[Mock Import] Error:", err);
      res.status(500).json({ error: err.message || "Failed to process mock import" });
    }
  });

  // Mock Reports Endpoints
  app.get("/api/mock-reports", (req, res) => {
    try {
      const mockReportPath = path.join(process.cwd(), "src", "data", "mock_reports.json");
      if (!fs.existsSync(mockReportPath)) return res.json([]);
      const data = JSON.parse(fs.readFileSync(mockReportPath, "utf-8"));
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/mock-reports", (req, res) => {
    try {
      const report = req.body;
      const mockReportPath = path.join(process.cwd(), "src", "data", "mock_reports.json");
      let reports: any[] = [];
      if (fs.existsSync(mockReportPath)) {
        try {
          reports = JSON.parse(fs.readFileSync(mockReportPath, "utf-8"));
        } catch {
          reports = [];
        }
      }
      reports.unshift(report);
      fs.writeFileSync(mockReportPath, JSON.stringify(reports, null, 2), "utf-8");
      res.json({ success: true, report });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/mock-reports/:id", (req, res) => {
    try {
      const { id } = req.params;
      const mockReportPath = path.join(process.cwd(), "src", "data", "mock_reports.json");
      if (fs.existsSync(mockReportPath)) {
        let reports = JSON.parse(fs.readFileSync(mockReportPath, "utf-8"));
        reports = reports.filter((r: any) => r.id !== id);
        fs.writeFileSync(mockReportPath, JSON.stringify(reports, null, 2), "utf-8");
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/mock-reports", (req, res) => {
    try {
      const mockReportPath = path.join(process.cwd(), "src", "data", "mock_reports.json");
      fs.writeFileSync(mockReportPath, "[]", "utf-8");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
