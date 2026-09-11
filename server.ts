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
    // 1. Data Interpretation
    if (/\b(bar graph|pie chart|table shows|histogram|line graph|data interpretation)\b/i.test(s)) return "Data Interpretation";
    // 2. Trigonometry & Height & Distance
    if (/\b(height and distance|angle of elevation|angle of depression)\b/i.test(s)) return "Height & Distance";
    if (/\b(sin|cos|tan|cot|sec|cosec|trigonometr)\b/i.test(s)) return "Trigonometry";
    // 3. Coordinate Geometry & Geometry
    if (/\b(coordinate|collinear|slope of|abscissa|ordinate|equation of line|line intersects)\b/i.test(s)) return "Coordinate Geometry";
    if (/\b(triangle|circle|chord|tangent|rhombus|parallelogram|trapezium|centroid|orthocenter|circumcenter|incenter|secant)\b/i.test(s)) return "Geometry";
    // 4. Mensuration 3D & 2D
    if (/\b(cone|cylinder|sphere|hemisphere|cuboid|cube|frustum|surface area|volume of)\b/i.test(s)) return "Mensuration 3D";
    if (/\b(area of triangle|area of circle|perimeter|semi-circle|sector|quadrilateral area|area of a rhombus|area of rectangle)\b/i.test(s)) return "Mensuration 2D";
    // 5. Statistics & Probability
    if (/\b(probability|sample space|dice is rolled|cards are drawn|coin is tossed)\b/i.test(s)) return "Probability";
    if (/\b(median|mode|variance|standard deviation|frequency distribution|statistics)\b/i.test(s)) return "Statistics";
    // 6. Boats & Streams, Trains, Time Speed & Distance
    if (/\b(boat|motorboat|stream|downstream|upstream|still water)\b/i.test(s)) return "Boats & Streams";
    if (/\b(train|platform|passes a pole|crosses a bridge|length of the train)\b/i.test(s)) return "Trains";
    if (/\b(speed|km\/h|relative speed|circular race|\brace\b|distance of \d+|km in \d+ hours|car travels|thief was spotted by a policeman|policeman started the chase)\b/i.test(s)) return "Time, Speed & Distance";
    // 7. Pipes & Cisterns & Time & Work
    if (/\b(pipes?|cistern|emptying|filling tap|leak in a tank)\b/i.test(s)) return "Pipes & Cisterns";
    if (/\b(work|worker|efficiency|alternate days?|days to complete|men and \d+ women can do a work)\b/i.test(s)) return "Time & Work";
    // 8. Mixture & Alligation & Partnership
    if (/\b(mixture|alligation|mixes|vessel has milk to water|replaced by water|types of flour|alloy|milk to water ratio equal to)\b/i.test(s)) return "Mixture & Alligation";
    if (/\b(partnership|invested in a business|business together|share of profit after|ratio of their investment|withdraw half his capital|three friends a, b, c invested)\b/i.test(s)) return "Partnership";
    // 9. Compound & Simple Interest
    if (/\b(compound interest|compounded|compounded annually|compounded half-yearly|compounded 8-monthly)\b/i.test(s)) return "Compound Interest";
    if (/\b(simple interest|per annum is ₹|sum becomes \d+ times|invested at \d+% per annum)\b/i.test(s)) return "Simple Interest";
    // 10. Profit, Loss & Discount
    if (/\b(marked price|cost price|selling price|discount|gain percentage|loss percentage|profit percentage|loss of|marked at|sold at rs|loss%)\b/i.test(s)) return "Profit, Loss & Discount";
    // 11. Average
    if (/\b(average|mean of|average score|average age|average salary|average weight|average of 5 results|average of a number)\b/i.test(s)) return "Average";
    // 12. Ratio & Proportion
    if (/\b(ratio|proportion|fourth proportional|mean proportional|third proportional|ratio of the number of|ratio equal to|divided among \d+|numbers are in the ratio|a : b =|ratio of their ages|2\/7 of the students are girls)\b/i.test(s)) return "Ratio & Proportion";
    // 13. Percentage
    if (/\b(percent|percentage|increased by \d+%|decreased by \d+%|\d+% of|marks and failed by|pass percentage|falls short by \d+ marks to pass|population of a city is increased|population decreases by|gives 7 parts .* what percentage)\b/i.test(s)) return "Percentage";
    // 14. LCM & HCF
    if (/\b(hcf|lcm|highest common factor|least common multiple)\b/i.test(s)) return "LCM & HCF";
    // 15. Simplification & Number System & Algebra
    if (/\b(simplify|simplification|value of \(\d+|\b(bodmas)\b)\b/i.test(s)) return "Simplification";
    if (/\b(divisible|remainder|prime number|unit digit|reciprocal|sum of two numbers is \d+ and their product)\b/i.test(s)) return "Number System";
    if (/\b(x\s*[\+\-\*\/]|polynomial|quadratic|x\^2|a\^3|b\^3|linear equation|identity|equation x\s*\/)\b/i.test(s)) return "Algebra";
    return "Number System";
  }

  if (/reasoning/i.test(subject)) {
    if (/\b(dice|cube|opposite to the face|positions of the same dice)\b/i.test(s)) return "Cube & Dice";
    if (/\b(interchange the signs|interchange the two signs|correct equation|mathematical operator|operator.*means|which two numbers should be interchanged|which of the two digits should be interchanged)\b/i.test(s)) return "Mathematical Operations";
    if (/\b(in a row of|row of children|how many children are there in that row|ranks? \d+|from the left end|from the right end|from the top|from the bottom|ranking|order and ranking)\b/i.test(s)) return "Ranking & Order";
    if (/\b(walks? \d+|turns? left|turns? right|walked \d+|towards north|towards south|towards east|towards west|shortest distance between .* starting)\b/i.test(s)) return "Direction & Distance";
    if (/\b(mirror image)\b/i.test(s)) return "Mirror Image";
    if (/\b(water image)\b/i.test(s)) return "Water Image";
    if (/\b(paper is folded|paper folding|unfolded|cutting)\b/i.test(s)) return "Paper Folding & Cutting";
    if (/\b(embedded|hidden figure)\b/i.test(s)) return "Embedded Figure";
    if (/\b(incomplete figure|figure completion|complete the given figure|pattern figure)\b/i.test(s)) return "Figure Completion";
    if (/\b(number of triangles|number of squares|counting of figures|figure counting|how many triangles)\b/i.test(s)) return "Figure Counting";
    if (/\b(clock|calendar|day of the week|leap year)\b/i.test(s)) return "Clock & Calendar";
    if (/\b(circular table|facing the center|linear row|seating arrangement)\b/i.test(s)) return "Seating Arrangement";
    if (/\b(mother|father|brother|sister|son|daughter|uncle|aunt|nephew|niece|husband|wife|photograph|blood relation)\b/i.test(s)) return "Blood Relations";
    if (/\b(statements?:|conclusions?:|all\s+\w+\s+are|some\s+\w+\s+are|no\s+\w+\s+is|syllogism)\b/i.test(s)) return "Syllogism";
    if (/\b(statement and assumption|assumption)\b/i.test(s)) return "Statement & Assumption";
    if (/\b(statement and conclusion)\b/i.test(s)) return "Statement & Conclusion";
    if (/\b(venn diagram|represents the relationship)\b/i.test(s)) return "Venn Diagram";
    if (/\b(odd one out|three of the following|four words have been given of which three are alike|does not belong|classification)\b/i.test(s)) return "Classification / Odd One Out";
    if (/\b(replace the question mark|number series|letter series|breaks the pattern|pattern|number sequence|number symbol series|letter, number, symbol series|\d+,\s*\d+,\s*\d+|cluster of five integers|pairs of numbers are there in|pairs of letters are there in|sequentially placed in the blanks of the given series)\b/i.test(s)) return "Series";
    if (/\b(coded as|code language|coding-decoding)\b/i.test(s)) return "Coding-Decoding";
    if (/\b(related to the third|in the same way as|analogy|related in the same)\b/i.test(s)) return "Analogy";
    if (/\b(missing number|matrix)\b/i.test(s)) return "Missing Number";
    if (/\b(puzzle)\b/i.test(s)) return "Puzzle";
    return "General Reasoning";
  }

  if (/english/i.test(subject)) {
    if (/\b(correctly spelt|incorrectly spelt|misspelt|spelling|spelled|spelt)\b/i.test(s)) return "Spelling Errors";
    if (/\b(indirect speech|direct speech|reported speech|narration)\b/i.test(s)) return "Direct & Indirect Speech";
    if (/\b(passive voice|active voice)\b/i.test(s)) return "Active & Passive Voice";
    if (/\b(one word substitution|one-word substitute|one word substitute|group of words)\b/i.test(s)) return "One Word Substitution";
    if (/\b([P-S]{4}|jumbled|para jumbles?|arrange the sentences|order of the parts|order to form a meaningful)\b/i.test(s)) return "Para Jumbles";
    if (/\b(substitute|substitution|underline|improve|sentence improvement)\b/i.test(s)) return "Sentence Improvement";
    if (/\b(synonym|antonym|similar|opposite in meaning|homonym)\b/i.test(s)) return "Synonyms & Antonyms";
    if (/\b(idiom|phrase)\b/i.test(s)) return "Idioms & Phrases";
    if (/\b(fill in the blank|blank)\b/i.test(s)) return "Fill in the Blanks";
    if (/\b(subject-verb agreement|subject verb agreement)\b/i.test(s)) return "Subject-Verb Agreement";
    if (/\b(preposition|prepositions)\b/i.test(s)) return "Prepositions";
    if (/\b(article|articles)\b/i.test(s)) return "Articles";
    if (/\b(conjunction|conjunctions)\b/i.test(s)) return "Conjunctions";
    if (/\b(pronoun|pronouns)\b/i.test(s)) return "Pronouns";
    if (/\b(tenses|sequence of tenses)\b/i.test(s)) return "Tenses";
    if (/\b(grammatical error|spot the error|contains an error|spotting error|grammatically correct)\b/i.test(s)) return "Spotting Errors";
    if (/\b(cloze|passage|reading comprehension)\b/i.test(s)) return "Cloze Test";
    return "Spotting Errors";
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
1. "topic": Classify into its official SSC CGL main syllabus topic:
   - For Mathematics:
     * Number System
     * Simplification
     * LCM & HCF
     * Percentage
     * Ratio & Proportion
     * Average
     * Profit, Loss & Discount
     * Simple Interest
     * Compound Interest
     * Time & Work
     * Pipes & Cisterns
     * Time, Speed & Distance
     * Boats & Streams
     * Trains
     * Mixture & Alligation
     * Partnership
     * Algebra
     * Geometry
     * Mensuration 2D
     * Mensuration 3D
     * Trigonometry
     * Height & Distance
     * Data Interpretation
     * Statistics
     * Probability
     * Coordinate Geometry
   - For English:
     * Error Detection & Grammar: Subject-Verb Agreement, Tenses, Articles, Prepositions, Conjunctions, Pronouns, Adjectives, Adverbs, Noun, Verb, Active & Passive Voice, Direct & Indirect Speech, Modals, Conditional Sentences, Spotting Errors
     * Vocabulary & Comprehension: Spelling Errors, Sentence Improvement, One Word Substitution, Idioms & Phrases, Synonyms & Antonyms, Fill in the Blanks, Cloze Test, Para Jumbles
   - For Reasoning:
     * Analogy
     * Classification / Odd One Out
     * Series
     * Coding-Decoding
     * Blood Relations
     * Direction & Distance
     * Ranking & Order
     * Venn Diagram
     * Syllogism
     * Statement & Conclusion
     * Statement & Assumption
     * Mathematical Operations
     * Missing Number
     * Puzzle
     * Seating Arrangement
     * Mirror Image
     * Water Image
     * Paper Folding & Cutting
     * Figure Completion
     * Embedded Figure
     * Figure Counting
     * Cube & Dice
     * Non-Verbal Series
     * Clock & Calendar
   - For General Awareness:
     * History
     * Polity
     * Geography
     * Economics
     * General Science
     * Static GK
     * Current Affairs
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

        // Also save mock questions for one-click practice
        try {
          const qDir = path.join(process.cwd(), "src", "data", "mock_questions");
          if (!fs.existsSync(qDir)) fs.mkdirSync(qDir, { recursive: true });
          fs.writeFileSync(path.join(qDir, `${calculatedReport.id}.json`), JSON.stringify(rawList, null, 2), "utf-8");
        } catch (qSaveErr) {
          console.error("[Mock Import] Error saving mock questions file:", qSaveErr);
        }
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

  // Mock Questions Endpoints
  app.get("/api/mock-questions/:id", (req, res) => {
    try {
      const { id } = req.params;
      const qPath = path.join(process.cwd(), "src", "data", "mock_questions", `${id}.json`);
      if (fs.existsSync(qPath)) {
        const questions = JSON.parse(fs.readFileSync(qPath, "utf-8"));
        return res.json(questions);
      }
      res.json([]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/mock-questions/:id", (req, res) => {
    try {
      const { id } = req.params;
      const questions = req.body;
      const qDir = path.join(process.cwd(), "src", "data", "mock_questions");
      if (!fs.existsSync(qDir)) fs.mkdirSync(qDir, { recursive: true });
      const qPath = path.join(qDir, `${id}.json`);
      fs.writeFileSync(qPath, JSON.stringify(questions, null, 2), "utf-8");
      res.json({ success: true });
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
      // Also delete questions file if exists
      const qPath = path.join(process.cwd(), "src", "data", "mock_questions", `${id}.json`);
      if (fs.existsSync(qPath)) {
        fs.unlinkSync(qPath);
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
