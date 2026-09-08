import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

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
  console.log(`[AI Processor] Sending ${questionsToProcess.length} questions to Gemini (${modelName})...`);

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const promptText = `You are an expert SSC CGL Exam Content Refiner. Process each question carefully:

Tasks for each question:
1. "topic": Classify into its official SSC CGL main syllabus topic (e.g. Percentage, Profit & Loss, SI & CI, Time & Work, Geometry, Mensuration, Algebra, Trigonometry, Number System, Syllogism, Blood Relations, Analogy, Coding-Decoding, Seating Arrangement, Direction & Distance, Error Spotting, Cloze Test, Idioms, Synonyms & Antonyms, History, Polity, Geography, Economics, General Science, Static GK).
2. "question": Clean and format the question prompt:
   - Restore mathematical powers/exponents and superscripts (e.g., if HTML superscripts flattened "31³ + 18³ - 37³" into "313 + 183 - 373" or "x²" into "x2", format properly as "31³ + 18³ - 37³ + 210" or "31^3 + 18^3 - 37^3 + 210" using the solution for context).
   - Strip any leaked option choices that were pasted at the end of the question text (e.g. trailing numbers or option lines following "is equal to:").
   - Remove residual platform noise (like "Reattempt mode is Off", "Marks +2", "Report", "Save", language headers).
3. "solution": Clean up the solution explanation (remove Hindi translation headers, footer UI buttons like "Previous/Next/Review", feedback surveys).
4. "correctOption": If the provided correctOption is "N/A", unknown, or invalid, analyze the question, options, and solution to determine the true correct option letter ("A", "B", "C", or "D"). If already a valid letter ("A", "B", "C", or "D"), confirm or correct it.

Questions to process:
${questionsToProcess.map((q, idx) => `[${idx}]
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

Return ONLY a JSON array with one object per question in exact order:
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

    const parsed = JSON.parse(response.text || "[]");
    if (!Array.isArray(parsed) || parsed.length !== questionsToProcess.length) {
      throw new Error(`Gemini response format mismatch: Expected ${questionsToProcess.length} items, received ${parsed.length || 0}. Raw: ${response.text}`);
    }

    parsed.forEach((item, idx) => {
      const originalIdx = toProcessIndices[idx];
      const originalQ = questions[originalIdx];
      results[originalIdx] = {
        topic: item.topic || "General",
        questionText: (item.question || originalQ.questionText || originalQ.question || "").trim(),
        solution: (item.solution || originalQ.solution || "").trim(),
        correctOption: (item.correctOption || originalQ.correctOption || "A").toUpperCase().trim()
      };
    });

    console.log(`[AI Processor] ✅ Successfully refined & classified all ${parsed.length} questions with Gemini!`);
    return results;
  } catch (err: any) {
    console.error(`[AI Processor] ❌ Gemini call failed:`, err?.message || err);
    throw new Error(`Gemini AI processing failed: ${err?.message || err}`);
  }
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
        console.warn(`[CGL-APP Server] ⚠️ [RECEIVE] Empty payload received`);
        return res.status(400).json({ error: "No questions in payload" });
      }

      console.log(`\n======================================================`);
      console.log(`[CGL-APP Server] 📥 [RECEIVE] Received ${rawList.length} questions from extension`);
      console.log(`[CGL-APP Server] 🚀 [START PROCESS] Running AI topic classification & text refinement...`);
      console.log(`======================================================`);

      // 1. Run AI topic classification, structure cleaning, and N/A answer resolution
      const enriched = await classifyAndRefineBatchWithAI(rawList);

      console.log(`[CGL-APP Server] 🤖 [PROCESS] AI classification complete. Distributing questions into error buckets...`);

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

        // Ensure chapters structure
        if (subjectName === "Mathematics" || subjectName === "Reasoning") {
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
          if (!chapters.some(c => c.chapter_title === "Unattempted")) {
            chapters.push({ chapter_num: 1, chapter_title: "Unattempted", subject: subjectName, subject_id: subjectId, questions: [] });
          }
          if (!chapters.some(c => c.chapter_title === "Wrong")) {
            chapters.push({ chapter_num: 2, chapter_title: "Wrong", subject: subjectName, subject_id: subjectId, questions: [] });
          }
        } else if (subjectName === "English") {
          if (chapters.length === 0) {
            chapters.push({ chapter_num: 1, chapter_title: "Mock Errors", subject: subjectName, subject_id: subjectId, questions: [] });
          }
        }

        let addedCount = 0;

        for (const item of items) {
          const q = item.raw;
          const status = q.status || "Incorrect";
          let targetTitle = "Wrong";

          if (subjectName === "Mathematics" || subjectName === "Reasoning") {
            if (status.includes("Slow") || status === "Speed Issue") {
              targetTitle = "Speed Issue";
            } else if (status.includes("Unattempted") || status.includes("Skipped")) {
              targetTitle = "Unattempted";
            } else {
              targetTitle = "Wrong";
            }
          } else if (subjectName === "General Awareness") {
            if (status.includes("Unattempted") || status.includes("Skipped")) {
              targetTitle = "Unattempted";
            } else {
              targetTitle = "Wrong";
            }
          } else {
            targetTitle = chapters[0]?.chapter_title || "Mock Errors";
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
              solution: (enr.solution || q.solution || "").trim(),
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
        console.log(`[CGL-APP Server] 💾 [SAVE] Saved to src/data/mock_errors/${fileName} (+${addedCount} new questions, total: ${chapters.reduce((acc: number, c: any) => acc + c.questions.length, 0)})`);
      }

      console.log(`======================================================`);
      console.log(`[CGL-APP Server] ✅ [FINISH] Mock import completed successfully!`);
      console.log(`[CGL-APP Server] 📊 [SUMMARY]:`, JSON.stringify(resultsSummary));
      console.log(`======================================================\n`);

      res.json({ success: true, imported: resultsSummary });
    } catch (err: any) {
      console.error(`[CGL-APP Server] ❌ [ERROR] Mock import failed:`, err.message || err);
      res.status(500).json({ error: err.message || "Failed to process mock import" });
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
