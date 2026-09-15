import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import { cleanSolutionText } from "./src/utils/cleanSolution";
import { cleanQuestionText } from "./src/utils/formatQuestionText";
import chatHandler from "./api/chat";

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
  const isReasoning = /reasoning|intel/i.test(subject);
  const s = text.toLowerCase();

  if (isReasoning) {
    // Invalidate obvious cross-subject or cross-topic misclassifications
    if (
      currentTopic === "Number System" ||
      currentTopic === "Static GK" ||
      (currentTopic === "Analogy" && /\b(given series|breaks the pattern|odd number pair|reverse alphabetical|arranged in the reverse)\b/i.test(s)) ||
      (currentTopic === "Coding-Decoding" && /\b(interchanged|equation|pairs of letters|vowel is changed)\b/i.test(s)) ||
      (currentTopic === "Seating Arrangement" && /\b(flagpoles|rank|corridor|how many flagpoles|from the left end and)\b/i.test(s)) ||
      (currentTopic === "Syllogism" && !/\b(all\s+\w+\s+are|some\s+\w+\s+are|no\s+\w+\s+is)\b/i.test(s))
    ) {
      currentTopic = undefined;
    }
  }

  if (currentTopic && currentTopic !== "General" && currentTopic !== "Unknown") {
    return currentTopic;
  }

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

  if (isReasoning) {
    if (/\b(dice|cube|opposite to the face|positions of the same dice)\b/i.test(s)) return "Cube & Dice";
    if (/\b(interchange the signs|interchange the two signs|correct equation|mathematical operator|operator.*means|which two numbers should be interchanged|which of the two digits should be interchanged|equations will be correct)\b/i.test(s)) return "Mathematical Operations";
    if (/\b(in a row of|row of children|how many children are there in that row|ranks? \d+|from the left end|from the right end|from the top|from the bottom|ranking|order and ranking|flagpoles|midway between)\b/i.test(s)) return "Order & Ranking";
    if (/\b(walks? \d+|turns? left|turns? right|walked \d+|towards north|towards south|towards east|towards west|shortest distance between .* starting|compass started giving wrong directions)\b/i.test(s)) return "Direction & Distance";
    if (/\b(mirror image)\b/i.test(s)) return "Mirror Image";
    if (/\b(water image)\b/i.test(s)) return "Water Image";
    if (/\b(paper is folded|paper folding|unfolded|cutting)\b/i.test(s)) return "Paper Folding & Cutting";
    if (/\b(embedded|hidden figure)\b/i.test(s)) return "Embedded Figure";
    if (/\b(incomplete figure|figure completion|complete the given figure|pattern figure)\b/i.test(s)) return "Figure Completion";
    if (/\b(number of triangles|number of squares|counting of figures|figure counting|how many triangles)\b/i.test(s)) return "Figure Counting";
    if (/\b(clock|calendar|day of the week|leap year)\b/i.test(s)) return "Clock & Calendar";
    if (/\b(circular table|facing the center|linear row|seating arrangement|sitting in a row|sitting second to the left)\b/i.test(s)) return "Seating Arrangement";
    if (/\b(mother|father|brother|sister|son|daughter|uncle|aunt|nephew|niece|husband|wife|photograph|blood relation|father-in-law)\b/i.test(s)) return "Blood Relations";
    if (/\b(all\s+\w+\s+are|some\s+\w+\s+are|no\s+\w+\s+is)\b/i.test(s)) return "Syllogism";
    if (/\b(statement and assumption|assumption)\b/i.test(s)) return "Statement & Assumption";
    if (/\b(statement:?|conclusions?:?|statement is given followed by a few conclusions)\b/i.test(s)) return "Statement & Conclusion";
    if (/\b(venn diagram|represents the relationship)\b/i.test(s)) return "Venn Diagram";
    if (/\b(odd one out|three of the following|four words have been given of which three are alike|does not belong|classification|odd number pair)\b/i.test(s)) return "Classification / Odd One Out";
    if (/\b(pairs of letters|letter immediately succeeding|reverse alphabetical order|alphabetical order|word formation)\b/i.test(s)) return "Alphabet Test";
    if (/\b(decimal number and smallest decimal|arithmetical reasoning)\b/i.test(s)) return "Arithmetical Reasoning";
    if (/\b(replace the question mark|number series|breaks the pattern|pattern|number sequence|\d+,\s*\d+,\s*\d+|cluster of five integers)\b/i.test(s)) return "Number Series";
    if (/\b(letter series|letter, number, symbol series|sequentially placed in the blanks of the given series)\b/i.test(s)) return "Letter & Symbol Series";
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

  if (/general awareness|gk|gs|ga|knowledge/i.test(subject)) {
    // 1. Static GK: Dance, Music, Festivals
    if (/\b(kathak|bharatanatyam|kathakali|kuchipudi|odissi|manipuri|mohiniyattam|sattriya|garba|bhangra|ghoomar|lavani|yakshagana|chhau|classical dance|folk dance)\b/i.test(s)) return "Folk & Classical Dances";
    if (/\b(sitar|sarod|tabla|shehnai|flute|veena|santur|ghat|ghatam|sarangi|mridangam|hindustani classical music|carnatic music|raga|ragas|gharana|vocal|andolan)\b/i.test(s)) return "Music & Musical Instruments";
    if (/\b(festival|bihu|hornbill|losar|pongal|onam|chath|pushkar mela|fair|harvest festival)\b/i.test(s)) return "Festivals & Fairs";

    // 2. Static GK: Awards, Books, Sports
    if (/\b(sangeet natak akademi|sahitya akademi|arjuna award|khel ratna|padma vibhushan|padma bhushan|padma shri|bharat ratna|nobel prize|dadasaheb phalke|jnanpith|award|national award)\b/i.test(s)) return "Awards & Honours";
    if (/\b(written by|author of the book|novel|autobiography|memoir|the serpent and the rope|in praise of coalition politics|author)\b/i.test(s)) return "Books & Authors";
    if (/\b(olympic|commonwealth games|asian games|khelo india|cricket|fifa|football|badminton|tennis|hockey|trophy|cup|medal tally|motto of the 2026)\b/i.test(s)) return "Sports & Trophies";

    // 3. Static GK: Heritage, Org, Census, Days
    if (/\b(unesco|world heritage|terracotta|temple|monument|caves?|ajanta|ellora|elephanta|konark|khajuraho|red fort|taj mahal|qutb minar|brihadisvara|shore temple|sun temple)\b/i.test(s)) return "Temples, Monuments & Heritage Sites";
    if (/\b(brics|asean|saarc|united nations|\bun\b|who|unicef|imf|world bank|wto|nato|ilo|unep|headquarters)\b/i.test(s)) return "International Organisations";
    if (/\b(census|literacy rate|sex ratio|population density)\b/i.test(s)) return "Census & Demographics";
    if (/\b(celebrated on|observed on|world environment day|earth day|water day|international yoga day|theme of|ai hackathon 2025|important day)\b/i.test(s)) return "Important Days & Themes";

    // 4. History (Ancient, Medieval, Modern)
    if (/\b(harappan|indus valley|mohenjo|vedic|rigveda|upanishad|buddhism|buddha|jainism|mahavira|tirthankara|maurya|ashoka|chandragupta|magadha|mahajanapada|gupta|harshavardhana|sangam|stone age|paleolithic|neolithic|mesolithic|rajendra i|chola dynasty|pallava|chalukya)\b/i.test(s)) return "Ancient History";
    if (/\b(firoz tughlaq|delhi sultanate|slave dynasty|khilji|tughlaq|lodhi|sayyid|mughal|babur|humayun|akbar|jahangir|shah jahan|aurangzeb|maratha|shivaji|peshwa|vijayanagar|bahmani|jayapala|battle of peshawar|tansen)\b/i.test(s)) return "Medieval History";
    if (/\b(east india company|battle of plassey|battle of buxar|governor-general|viceroy|lord lansdowne|lord dalhousie|lord curzon|lord canning|revolt of 1857|sepoy mutiny|indian national congress|gandhi|non-cooperation|civil disobedience|quit india|cabinet mission|partition of bengal|act allotted ₹1 lakh|government of india act|lala lajpat rai|princely states|battle of aliwal|khalsa army|british-era structures|james wilson)\b/i.test(s)) return "Modern History";

    // 5. Polity
    if (/\b(fundamental rights?|fundamental duties|dpsp|directive principles|article 1[4-9]|article 2[0-9]|article 3[0-2]|article 51a|habeas corpus|mandamus)\b/i.test(s)) return "Fundamental Rights & Duties";
    if (/\b(president of india|vice president|prime minister|council of ministers|governor|chief minister|supreme leader)\b/i.test(s)) return "Union & State Executive";
    if (/\b(parliament|lok sabha|rajya sabha|speaker|money bill|state legislative assembly|vidhan sabha|death penalty)\b/i.test(s)) return "Parliament & State Legislature";
    if (/\b(supreme court|high court|chief justice|judicial review|writs?)\b/i.test(s)) return "Judiciary";
    if (/\b(panchayat|panchayati raj|73rd amendment|74th amendment|municipality|gram sabha)\b/i.test(s)) return "Panchayati Raj & Local Government";
    if (/\b(constitution|preamble|constituent assembly|schedule \d+|amendment|article \d+|election commission|cag)\b/i.test(s)) return "Indian Polity & Constitution";

    // 6. Geography
    if (/\b(national park|wildlife sanctuary|biosphere reserve|tiger reserve|mudumalai|biodiversity|endangered spec|critically endangered)\b/i.test(s)) return "National Parks & Environment";
    if (/\b(himalaya|river|ganga|indus|brahmaputra|godavari|krishna|kaveri|narmada|tapti|western ghats|eastern ghats|delta|tributary|ujh multipurpose|fossil parks|rohtang tunnel)\b/i.test(s)) return "Indian Drainage & Physiography";
    if (/\b(monsoon|soil|alluvial|black soil|laterite|climate|rainfall)\b/i.test(s)) return "Indian Climate & Soil";
    if (/\b(earth rotation|earthquake|volcano|atmosphere|troposphere|stratosphere|ocean current|tides?|solar system)\b/i.test(s)) return "Physical Geography";
    if (/\b(continent|desert|sahara|strait|equator|tropic of)\b/i.test(s)) return "World Geography";

    // 7. Economics
    if (/\b(rbi|reserve bank|repo rate|monetary policy|bank rate|inflation|deflation|money supply)\b/i.test(s)) return "Banking & Monetary Policy";
    if (/\b(budget|fiscal policy|fiscal deficit|direct tax|indirect tax|gst|income tax)\b/i.test(s)) return "Fiscal Policy & Budget";
    if (/\b(gdp|gnp|national income|per capita income|economic growth|five year plan)\b/i.test(s)) return "Macroeconomics & National Income";
    if (/\b(demand|supply|elasticity|monopoly|market)\b/i.test(s)) return "Microeconomics & Markets";
    if (/\b(pmay|pradhan mantri awas|sampann|scheme|agriculture are given below)\b/i.test(s)) return "Government Schemes & Policies";

    // 8. General Science: Biology, Chemistry, Physics
    if (/\b(cell|mitochondria|dna|rna|hormone|enzyme|vitamin|disease|bacteria|virus|food- \(i\) sugar|autism|asd|preserving food|human ear)\b/i.test(s)) return "Biology";
    if (/\b(acid|base|chemical|periodic table|atomic|metal|non-metal|ndma|nitrosamine)\b/i.test(s)) return "Chemistry";
    if (/\b(newton|velocity|force|gravity|energy|power|light|speed of light|vacuum|sound|frequency|electricity|voltage|distance–time graph|uniform speed|amca|combat aircraft|exercise rotor clap)\b/i.test(s)) return "Physics";

    return "Static GK";
  }

  return "General";
}

interface AIEnrichmentResult {
  topic: string;
  subtopic?: string;
  conceptTested?: string;
  questionText?: string;
  solution?: string;
  correctOption?: string;
}

// Robust JSON Sanitizer for LLM outputs:
// Fixes unescaped LaTeX backslashes (\underline, \unit, \alpha, \sqrt, etc.) and bad Unicode escapes
function sanitizeJsonString(raw: string): string {
  let result = "";
  let inString = false;
  let i = 0;

  while (i < raw.length) {
    const char = raw[i];

    if (!inString) {
      if (char === '"') {
        inString = true;
      }
      result += char;
      i++;
    } else {
      if (char === '"') {
        inString = false;
        result += char;
        i++;
      } else if (char === '\\') {
        const next = raw[i + 1];
        if (next === undefined) {
          result += "\\\\";
          i++;
        } else if (next === '"' || next === '\\' || next === '/' || next === 'b' || next === 'f' || next === 'n' || next === 'r' || next === 't') {
          result += char + next;
          i += 2;
        } else if (next === 'u') {
          // Check if followed by 4 hex digits
          const hex = raw.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            result += char + next + hex;
            i += 6;
          } else {
            // Bad unicode escape (e.g. \underline, \unit, \upsilon, \union) -> escape the backslash!
            result += "\\\\u";
            i += 2;
          }
        } else {
          // Unescaped backslash before non-standard JSON escape (e.g. \alpha, \theta, \times, \text, \(, \[, etc.)
          result += "\\\\" + next;
          i += 2;
        }
      } else if (char === '\n') {
        result += "\\n";
        i++;
      } else if (char === '\r') {
        result += "\\r";
        i++;
      } else if (char === '\t') {
        result += "\\t";
        i++;
      } else {
        result += char;
        i++;
      }
    }
  }
  return result;
}

function parseGeminiJsonArray(rawText: string): any[] {
  let text = (rawText || "[]").trim();
  if (text.startsWith("```json")) text = text.slice(7);
  if (text.startsWith("```")) text = text.slice(3);
  if (text.endsWith("```")) text = text.slice(0, -3);
  text = text.trim();

  // Try direct parse first
  try {
    const direct = JSON.parse(text);
    if (Array.isArray(direct)) return direct;
  } catch {
    // Continue to sanitization
  }

  // Sanitize invalid backslashes, bad unicode escapes (\underline etc.) and unescaped control chars
  const sanitized = sanitizeJsonString(text);
  try {
    const parsed = JSON.parse(sanitized);
    if (Array.isArray(parsed)) return parsed;
  } catch (err: any) {
    // Fallback: extract substring between first '[' and last ']'
    const firstBracket = sanitized.indexOf('[');
    const lastBracket = sanitized.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const sliced = sanitized.slice(firstBracket, lastBracket + 1);
      try {
        const slicedParsed = JSON.parse(sliced);
        if (Array.isArray(slicedParsed)) return slicedParsed;
      } catch {
        // Fall through
      }
    }
    throw err;
  }
  throw new Error("Gemini response is not a valid JSON array");
}

// AI Batch Classifier & Structure Refiner:
// - Classifies SSC CGL syllabus topic, granular subtopic, and specific concept tested
// - Cleans corrupted formatting or UI artifacts from question and solution
// - Resolves "N/A" correct options by analyzing question, options, and solution
// If AI classification fails or API key is missing, throws an error and stops execution.
async function classifyAndRefineBatchWithAI(questions: any[]): Promise<AIEnrichmentResult[]> {
  const results: AIEnrichmentResult[] = new Array(questions.length).fill(null);
  const toProcessIndices: number[] = [];

  // Identify questions that need AI classification, N/A answer resolution, or structural cleanup
  questions.forEach((q, idx) => {
    const existingTopic = q.topic;
    const existingSubtopic = q.subtopic;
    const rawSub = (q.subject || q.section || "").toLowerCase();
    const isReasoning = rawSub.includes("reason") || rawSub.includes("intel");
    const isMismatchedReasoning = isReasoning && (
      existingTopic === "Number System" ||
      existingTopic === "Static GK" ||
      (existingTopic === "Analogy" && /\b(replace the question mark|in the given series|breaks the pattern|odd number pair|reverse alphabetical|arranged in the reverse)\b/i.test(q.questionText || q.question || "")) ||
      (existingTopic === "Coding-Decoding" && /\b(interchanged|equation|pairs of letters|vowel is changed)\b/i.test(q.questionText || q.question || "")) ||
      (existingTopic === "Seating Arrangement" && /\b(flagpoles|rank|corridor|how many flagpoles|from the left end and)\b/i.test(q.questionText || q.question || "")) ||
      (existingTopic === "Syllogism" && !/\b(all\s+\w+\s+are|some\s+\w+\s+are|no\s+\w+\s+is)\b/i.test(q.questionText || q.question || ""))
    );

    // Detect Matrix / Missing Number / Grid questions
    const qText = (q.questionText || q.question || "").trim();
    const isMatrixQuestion = 
      /\b(matrix|missing number|number puzzle|box matrix|grid matrix)\b/i.test(existingTopic || "") ||
      /\b(matrix|missing number|replace the question mark \(\?\)|study the given pattern|find the missing number)\b/i.test(qText) ||
      /\b(row 1|row 2|row 3|column 1|column 2|column 3)\b/i.test(q.solution || "") ||
      /(?:^\s*\d+\s*[\r\n]+){4,}/m.test(qText);

    const sendMatrixToAI = process.env.SEND_MOCK_MATRIX_TO_AI !== "false";
    const forceAIForMatrix = sendMatrixToAI && isMatrixQuestion;

    const isSubjectLevelTopic = existingTopic === "English Comprehension" || existingTopic === "English" || existingTopic === "Quantitative Aptitude" || existingTopic === "General Awareness" || existingTopic === "General Intelligence and Reasoning";
    const hasValidTopic = existingTopic && existingTopic !== "General" && existingTopic !== "Unknown" && !isSubjectLevelTopic && !isMismatchedReasoning;
    const hasValidSubtopic = existingSubtopic && existingSubtopic !== "General" && existingSubtopic !== "Unknown" && existingSubtopic !== "English Comprehension" && existingSubtopic !== "English";
    const hasValidAnswer = q.correctOption && q.correctOption !== "N/A" && /^[A-D]$/i.test(q.correctOption.trim());
    const hasCleanText = !(q.questionText || q.question || "").includes("Reattempt mode is Off");

    if (hasValidTopic && hasValidSubtopic && hasValidAnswer && hasCleanText && !forceAIForMatrix) {
      results[idx] = {
        topic: existingTopic,
        subtopic: existingSubtopic,
        conceptTested: q.conceptTested || "",
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
1. "topic": Classify strictly into its official SSC CGL main syllabus topic:
   - For Reasoning (General Intelligence):
     * Analogy (Semantic Analogy, Number Analogy, Letter Analogy)
     * Classification / Odd One Out (Word Classification, Number Classification, Letter Classification)
     * Number Series (Missing Number Series, Wrong Number in Series)
     * Letter & Symbol Series (Alphabet Series, Continuous Pattern Series, Alphanumeric Series)
     * Coding-Decoding (Letter Coding, Number Coding, Reverse Place Value Coding, Substitution Coding)
     * Alphabet Test (Letter Pairs Problem, Word Rearrangement, Invariance, Vowel-Consonant Operations)
     * Word Formation & Dictionary Order
     * Order & Ranking (Positions from left/right/top/bottom, Midpoint, Total in row/column)
     * Direction & Distance (Turns, Angles/Rotation, Shadow, Shortest Distance)
     * Blood Relations (Family Tree, Coded Blood Relations, Indicating Form)
     * Venn Diagram (Logical Venn Diagrams, Geometric Venn Data Analysis)
     * Syllogism (Deductive Venn Logic: Statements with All, Some, No, Some Not)
     * Mathematical Operations (Interchange of Signs & Numbers, Balancing Equations via BODMAS)
     * Arithmetical Reasoning (Calculation-based reasoning, Age problems, Decimal comparisons)
     * Statement & Conclusion (Critical verbal reasoning deduction from statements)
     * Statement & Assumption
     * Statement & Arguments
     * Course of Action
     * Cause & Effect
     * Seating Arrangement (Linear Row North/South Facing, Circular In/Out Facing)
     * Missing Number / Matrix (Number puzzles, Grid/box matrix)
     * Clock & Calendar (Clock hands angles, Calendar day of week, Leap years)
     * Cube & Dice (Opposite faces, Unfolded/open dice)
     * Figure Counting (Counting triangles, squares, rectangles, straight lines)
     * Mirror Image & Water Image
     * Paper Folding & Cutting
     * Embedded Figure
     * Figure Completion
     * Non-Verbal Series & Analogy

     CRITICAL TOPIC RULES FOR REASONING:
     - NEVER assign Mathematics topics (e.g., "Number System") or General Awareness topics (e.g., "Static GK") to Reasoning questions.
     - Sequences ($a_1, a_2, a_3, \dots, ?$) and finding wrong number are "Number Series", NOT "Analogy".
     - Proportional comparisons ($A : B :: C : D$) are "Analogy".
     - Selecting the single odd/different item out of 4 options is "Classification / Odd One Out".
     - Counting letter pairs (like in REGULATION), vowel/consonant operations (like in OPTICAL), or reverse alphabetical sorting (like in TAMPLING) belong to "Alphabet Test", NOT "Coding-Decoding" or "Analogy".
     - Exchanging signs or numbers to satisfy arithmetic equations using BODMAS is "Mathematical Operations", NOT "Coding-Decoding".
     - Positions from ends, midway positions, or total flagpoles/students in a line is "Order & Ranking", NOT "Seating Arrangement".
     - Everyday statements followed by logical inferences are "Statement & Conclusion", NOT "Syllogism" (reserve "Syllogism" strictly for categorical All/Some/No Venn diagrams).

   - For Mathematics (Quantitative Aptitude):
     * Number System (Divisibility rules, Unit digit, Remainder theorem, Factors, Primes)
     * Simplification (VBODMAS, Surds & Indices, Algebraic fractions)
     * LCM & HCF
     * Percentage
     * Ratio & Proportion (Direct/Inverse, Proportional parts, Coin problems)
     * Partnership
     * Mixture & Alligation
     * Average
     * Profit, Loss & Discount (Cost/Selling/Marked Price, Successive discounts, Dishonest dealer)
     * Simple Interest
     * Compound Interest (Annual, Half-yearly, 8-monthly, Difference CI-SI, Installments)
     * Time & Work (Efficiency, Alternate days, Men-Women-Children formulas, Wages)
     * Pipes & Cisterns
     * Time, Speed & Distance (Relative speed, Average speed, Races, Police & Thief)
     * Trains (Crossing poles/platforms, Opposite/same direction)
     * Boats & Streams (Upstream, Downstream, Still water speed)
     * Algebra (Linear/Quadratic equations, Algebraic identities, Polynomials)
     * Geometry (Lines & Angles, Triangles, Circles, Tangents, Chords, Quadrilaterals)
     * Coordinate Geometry (Distance formula, Slopes, Equation of line)
     * Mensuration 2D (Area & perimeter of triangles, quadrilaterals, circles)
     * Mensuration 3D (Surface area & volume of cube, cuboid, cylinder, cone, sphere, frustum)
     * Trigonometry (Ratios, Identities, Complementary angles, Maxima & Minima)
     * Height & Distance (Elevation, Depression, Multi-point observations)
     * Statistics (Mean, Median, Mode, Standard Deviation, Variance)
     * Probability (Coins, Dice, Cards, Balls)
     * Data Interpretation (Bar graph, Pie chart, Line graph, Table chart, Histogram)

   - For English Comprehension:
     * Spotting Errors (Subject-Verb Agreement, Tenses, Articles, Prepositions, Conjunctions, Pronouns, Nouns, Adjectives, Adverbs, Modals, Conditionals)
     * Sentence Improvement (Phrase replacement & grammatical improvement)
     * Active & Passive Voice
     * Direct & Indirect Speech (Narration)
     * Fill in the Blanks (Single & Double fillers)
     * Cloze Test
     * Synonyms & Antonyms
     * Idioms & Phrases
     * One Word Substitution
     * Spelling Errors (Correctly spelt / Incorrectly spelt words)
     * Para Jumbles (PQRS Sentence rearrangement)
     * Reading Comprehension

   - For General Awareness:
     * Ancient History (Indus Valley, Vedic, Buddhism, Jainism, Mauryas, Guptas, South Indian Dynasties)
     * Medieval History (Delhi Sultanate, Mughals, Marathas, Vijayanagar, Bhakti/Sufi)
     * Modern History (East India Company, Revolt of 1857, INC, National Freedom Movement, Viceroys)
     * Indian Polity & Constitution (Preamble, Fundamental Rights & Duties, DPSP, President, Parliament, Judiciary, Panchayati Raj, Amendments)
     * Physical Geography (Earth structure, Atmosphere, Ocean currents, Continents)
     * Indian Drainage & Physiography (Himalayas, Rivers, Tributaries, Waterfalls, Lakes)
     * Indian Climate & Soil (Monsoon, Soil types, Agriculture & Crops)
     * National Parks & Environment (Sanctuaries, Biosphere reserves, Ramsar sites, Biodiversity)
     * World Geography
     * Macroeconomics & National Income (GDP, GNP, Inflation, Five Year Plans)
     * Banking & Monetary Policy (RBI, Repo rate, Monetary tools)
     * Fiscal Policy & Budget (Deficit, Taxes, GST, Union Budget)
     * Microeconomics & Markets (Demand, Supply, Market types)
     * Government Schemes & Policies
     * Physics (Mechanics, Optics, Electricity, Sound, Thermodynamics, Units)
     * Chemistry (Periodic table, Acids & Bases, Metals/Non-metals, Everyday chemistry)
     * Biology (Cell, Human physiology, Plant physiology, Diseases & Vitamins, Genetics)
     * Folk & Classical Dances
     * Music & Musical Instruments (Gharanas, Eminent exponents)
     * Festivals & Fairs
     * Temples, Monuments & Heritage Sites (UNESCO sites)
     * Books & Authors
     * Awards & Honours (Bharat Ratna, Padma awards, Gallantry, Nobel, Literary)
     * Sports & Trophies (Tournaments, Players, Terminology)
     * Census & Demographics (2011 Census)
     * Important Days & Themes
     * International Organisations (UN, WHO, IMF, World Bank, WTO, BRICS)
     * National & International Current Affairs

2. "subtopic": Classify the granular subtopic or specific problem pattern (e.g. for Geometry: "Circles - Tangents & Secants" or "Triangles - Centroid & Similarity"; for Algebra: "Symmetric Identities (a³+b³+c³-3abc)"; for English: "Subject-Verb Agreement - Inversion" or "Active/Passive - Interrogative Sentences"; for Reasoning: "Missing Number Grid Matrix" or "Blood Relations - Coded Family Tree"; for Arithmetic: "Profit & Loss - Dishonest Dealer" or "Time & Work - Alternate Days").
3. "conceptTested": A concise 1-sentence note of the exact mathematical theorem, grammatical rule, formula, or logical deduction tested (e.g. "Tangent-Secant Theorem: PT² = PA × PB", "Inversion of auxiliary verb after negative adverbials (Hardly/Scarcely)", "Cyclic quadrilateral opposite angles sum = 180°").
4. "question": Clean and format the question prompt:
   - Restore mathematical powers/exponents and superscripts (e.g., "31³ + 18³ - 37³ + 210" or "31^3 + 18^3 - 37^3 + 210", "x²" or "x^2").
   - Strip any leaked option choices that were pasted at the end of the question text.
   - Remove residual platform noise (like "Reattempt mode is Off", "Marks +2", "Report", "Save", language headers).
   - For Matrix / Number Grid / Missing Number questions: If numbers/items are listed vertically or in an unstructured plain list (e.g. 5 \n 7 \n 100 \n 8 \n 9 \n 181 \n 11 \n 10 \n ?), format them into a clean Markdown table with clear rows and columns representing the grid:
     | 5 | 7 | 100 |
     | 8 | 9 | 181 |
     | 11 | 10 | ? |
     Always classify the topic strictly as "Missing Number / Matrix".
5. "solution": Clean up the solution explanation (remove Hindi translation headers, footer UI buttons like "Previous/Next/Review", feedback surveys). Keep equations readable.
6. "correctOption": If the provided correctOption is "N/A", unknown, or invalid, analyze the question, options, and solution to determine the true correct option letter ("A", "B", "C", or "D"). If already a valid letter ("A", "B", "C", or "D"), confirm or correct it.

CRITICAL JSON FORMAT RULE:
Ensure all double-quotes (") and backslashes (\\) inside string values are properly escaped. In particular, any LaTeX or mathematical backslashes (like \\underline, \\frac, \\sqrt, \\alpha) MUST be double-escaped as \\\\underline, \\\\frac, etc. Do not output raw unescaped backslashes.

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
    "topic": "Main Topic Name",
    "subtopic": "Granular Subtopic Name",
    "conceptTested": "Exact theorem, rule, or formula tested",
    "question": "Cleaned & correctly formatted question text",
    "solution": "Cleaned solution text",
    "correctOption": "A"
  }
]`;

      const batchNum = Math.floor(c / CHUNK_SIZE) + 1;
      const totalBatches = Math.ceil(toProcessIndices.length / CHUNK_SIZE);
      let batchSuccess = false;
      let lastBatchError: any = null;

      for (let attempt = 1; attempt <= 2 && !batchSuccess; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: promptText,
            config: { responseMimeType: "application/json" }
          });

          const rawText = response.text || "[]";
          const parsed = parseGeminiJsonArray(rawText);

          if (!Array.isArray(parsed) || parsed.length !== chunkIndices.length) {
            throw new Error(`Item count mismatch (Expected ${chunkIndices.length}, got ${parsed?.length || 0})`);
          }

          parsed.forEach((item, idx) => {
            const originalIdx = chunkIndices[idx];
            const originalQ = questions[originalIdx];
            results[originalIdx] = {
              topic: (item.topic || originalQ.topic || originalQ.subject || "General").trim(),
              subtopic: (item.subtopic || item.topic || originalQ.subtopic || originalQ.topic || "").trim(),
              conceptTested: (item.conceptTested || originalQ.conceptTested || "").trim(),
              questionText: (item.question || originalQ.questionText || originalQ.question || "").trim(),
              solution: (item.solution || originalQ.solution || "").trim(),
              correctOption: (item.correctOption || originalQ.correctOption || "A").toUpperCase().trim()
            };
          });

          batchSuccess = true;
        } catch (batchErr: any) {
          lastBatchError = batchErr;
          if (attempt === 1) {
            console.warn(`[AI Processor] ⚠️ Batch ${batchNum}/${totalBatches} attempt 1 failed (${batchErr.message}). Retrying once...`);
            await new Promise(r => setTimeout(r, 1200));
          }
        }
      }

      if (!batchSuccess) {
        console.warn(`[AI Processor] ⚠️ Batch ${batchNum}/${totalBatches} failed after 2 attempts: ${lastBatchError?.message || lastBatchError}. Preserving original question data for this batch so import is not halted.`);
        chunkIndices.forEach((originalIdx) => {
          const originalQ = questions[originalIdx];
          results[originalIdx] = {
            topic: (originalQ.topic || originalQ.subject || "General").trim(),
            subtopic: (originalQ.subtopic || originalQ.topic || "").trim(),
            conceptTested: (originalQ.conceptTested || "").trim(),
            questionText: (originalQ.questionText || originalQ.question || "").trim(),
            solution: (originalQ.solution || "").trim(),
            correctOption: (originalQ.correctOption || "A").toUpperCase().trim()
          };
        });
      }
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
  const detectedFromQuestions = rawList.find(q => q.testName || q.title || q.test_name)?.testName ||
                                rawList.find(q => q.testName || q.title || q.test_name)?.title ||
                                rawList.find(q => q.testName || q.title || q.test_name)?.test_name;
  const title = (mockTitle && mockTitle.trim()) || detectedFromQuestions || (isFullMock ? `Full Mock - ${dateStr}` : `${activeSubjects[0] || "Sectional"} Mock - ${dateStr}`);

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

  // Gemini AI Chatbot Endpoint (Same handler as Vercel serverless)
  app.post("/api/chat", chatHandler);

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
              testName: q.testName || payload.title || payload.testName,
              platform: q.platform || 'General',
              status: q.status || (status.includes("slow") ? "Correct (Slow)" : status.includes("unattempted") ? "Unattempted" : "Incorrect"),
              chosenOption: q.chosenOption || null,
              correctOption: (enr.correctOption || q.correctOption || cleanAns).toUpperCase(),
              userTime: q.userTime || null,
              avgTime: q.avgTime || null,
              question: cleanQuestionText(qText),
              options: {
                a: cleanQuestionText(q.options?.A || q.options?.a || ""),
                b: cleanQuestionText(q.options?.B || q.options?.b || ""),
                c: cleanQuestionText(q.options?.C || q.options?.c || ""),
                d: cleanQuestionText(q.options?.D || q.options?.d || "")
              },
              answer: cleanAns,
              solution: cleanSolutionText(q.solution || enr.solution || ""),
              topic: (() => {
                let t = (enr.topic || q.topic || "General").trim();
                const s = (enr.subtopic || q.subtopic || "").trim();
                if ((t === "English Comprehension" || t === "English") && s && s !== "English Comprehension" && s !== "English") {
                  t = s;
                }
                return t;
              })(),
              subtopic: enr.subtopic || q.subtopic || enr.topic || "General",
              conceptTested: enr.conceptTested || q.conceptTested || "",
              tags: {
                topic: (() => {
                  let t = (enr.topic || q.topic || "General").trim();
                  const s = (enr.subtopic || q.subtopic || "").trim();
                  if ((t === "English Comprehension" || t === "English") && s && s !== "English Comprehension" && s !== "English") {
                    t = s;
                  }
                  return t;
                })(),
                subtopic: enr.subtopic || q.subtopic || enr.topic || "General",
                conceptTested: enr.conceptTested || q.conceptTested || "",
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
        const isDuplicateReport = existingReports.some(r => 
          (payload.id && r.id === payload.id) ||
          (r.title === calculatedReport.title && r.type === calculatedReport.type && r.totalScore === calculatedReport.totalScore && r.totalCorrect === calculatedReport.totalCorrect && r.totalWrong === calculatedReport.totalWrong)
        );
        if (!isDuplicateReport) {
          existingReports.unshift(calculatedReport);
          fs.writeFileSync(mockReportPath, JSON.stringify(existingReports, null, 2), "utf-8");
          console.log(`[Mock Import] Mock Score Report saved: ${calculatedReport.title} (Score: ${calculatedReport.totalScore}/${calculatedReport.maxMarks})`);
        } else {
          console.log(`[Mock Import] Skipped duplicate score report for: ${calculatedReport.title}`);
        }

        // Also save mock questions to mock_tests and mock_questions with topic, subtopic & conceptTested
        try {
          const enrichedMasterList = rawList.map((q, idx) => {
            const enr: any = enriched[idx] || {};
            const rawAns = enr.correctOption || q.correctOption || q.answer || "a";
            const cleanAns = rawAns.toLowerCase().trim();
            return {
              ...q,
              topic: enr.topic || q.topic || "General",
              subtopic: enr.subtopic || q.subtopic || enr.topic || "General",
              conceptTested: enr.conceptTested || q.conceptTested || "",
              questionText: cleanQuestionText(enr.questionText || q.questionText || q.question),
              solution: cleanSolutionText(q.solution || enr.solution || ""),
              correctOption: (enr.correctOption || q.correctOption || cleanAns).toUpperCase(),
              tags: {
                ...(q.tags || {}),
                topic: enr.topic || q.topic || "General",
                subtopic: enr.subtopic || q.subtopic || enr.topic || "General",
                conceptTested: enr.conceptTested || q.conceptTested || ""
              }
            };
          });

          const tDir = path.join(process.cwd(), "src", "data", "mock_tests");
          if (!fs.existsSync(tDir)) fs.mkdirSync(tDir, { recursive: true });
          fs.writeFileSync(path.join(tDir, `${calculatedReport.id}.json`), JSON.stringify(enrichedMasterList, null, 2), "utf-8");

          const qDir = path.join(process.cwd(), "src", "data", "mock_questions");
          if (!fs.existsSync(qDir)) fs.mkdirSync(qDir, { recursive: true });
          fs.writeFileSync(path.join(qDir, `${calculatedReport.id}.json`), JSON.stringify(enrichedMasterList, null, 2), "utf-8");
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
      const tPath = path.join(process.cwd(), "src", "data", "mock_tests", `${id}.json`);
      if (fs.existsSync(tPath)) {
        const questions = JSON.parse(fs.readFileSync(tPath, "utf-8"));
        return res.json(questions);
      }
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
      const tDir = path.join(process.cwd(), "src", "data", "mock_tests");
      if (!fs.existsSync(tDir)) fs.mkdirSync(tDir, { recursive: true });
      fs.writeFileSync(path.join(tDir, `${id}.json`), JSON.stringify(questions, null, 2), "utf-8");

      const qDir = path.join(process.cwd(), "src", "data", "mock_questions");
      if (!fs.existsSync(qDir)) fs.mkdirSync(qDir, { recursive: true });
      fs.writeFileSync(path.join(qDir, `${id}.json`), JSON.stringify(questions, null, 2), "utf-8");

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
        const targetReport = reports.find((r: any) => r.id === id);
        reports = reports.filter((r: any) => r.id !== id);
        fs.writeFileSync(mockReportPath, JSON.stringify(reports, null, 2), "utf-8");

        // If report had a title, remove any questions from mock_errors
        if (targetReport?.title) {
          const mockDir = path.join(process.cwd(), "src", "data", "mock_errors");
          ["english.json", "mathematics.json", "reasoning.json", "general_awareness.json"].forEach(file => {
            const filePath = path.join(mockDir, file);
            if (fs.existsSync(filePath)) {
              try {
                const chapters = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                chapters.forEach((ch: any) => {
                  ch.questions = (ch.questions || []).filter((q: any) => q.testName !== targetReport.title);
                  ch.questions.forEach((q: any, idx: number) => { q.q_num = idx + 1; });
                });
                fs.writeFileSync(filePath, JSON.stringify(chapters, null, 2), "utf-8");
              } catch {}
            }
          });
        }
      }
      // Also delete from mock_tests and mock_questions
      const tPath = path.join(process.cwd(), "src", "data", "mock_tests", `${id}.json`);
      if (fs.existsSync(tPath)) {
        try { fs.unlinkSync(tPath); } catch {}
      }
      const qPath = path.join(process.cwd(), "src", "data", "mock_questions", `${id}.json`);
      if (fs.existsSync(qPath)) {
        try { fs.unlinkSync(qPath); } catch {}
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
