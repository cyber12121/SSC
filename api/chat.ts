import fs from 'fs';
import path from 'path';

export interface QuestionErrorRecord {
  id?: string;
  testName?: string;
  platform?: string;
  qNum?: number | string;
  subject: string;
  topic: string;
  subtopic?: string;
  conceptTested?: string;
  status?: string;
  chosenOption?: string;
  correctOption?: string;
  userTime?: string;
  avgTime?: string;
  rcaTag?: string;
  question: string;
  options?: Record<string, string>;
  solution?: string;
}

export interface TopicIndexEntry {
  topic: string;
  subject: string;
  totalErrors: number;
  wrongCount: number;
  slowCount: number;
  unattemptedCount: number;
  conceptsTested: Set<string>;
  rcaCounts: Record<string, number>;
  sampleErrors: QuestionErrorRecord[];
}

export interface MockScorecard {
  id: string;
  title: string;
  date?: string;
  totalScore: number;
  maxMarks: number;
  overallAccuracy?: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnattempted: number;
  sections?: Record<string, any>;
}

// ── 1. Comprehensive SSC Topic Aliases & Typo Mapping ──
export const TOPIC_ALIASES: Record<string, { canonical: string; subject: string }> = {
  // English
  'active passive': { canonical: 'Active & Passive Voice', subject: 'English' },
  'active voice': { canonical: 'Active & Passive Voice', subject: 'English' },
  'passive voice': { canonical: 'Active & Passive Voice', subject: 'English' },
  'voice': { canonical: 'Active & Passive Voice', subject: 'English' },
  'narration': { canonical: 'Direct & Indirect Speech', subject: 'English' },
  'direct indirect': { canonical: 'Direct & Indirect Speech', subject: 'English' },
  'indirect speech': { canonical: 'Direct & Indirect Speech', subject: 'English' },
  'direct speech': { canonical: 'Direct & Indirect Speech', subject: 'English' },
  'synonym': { canonical: 'Synonyms & Antonyms', subject: 'English' },
  'synonyms': { canonical: 'Synonyms & Antonyms', subject: 'English' },
  'antonym': { canonical: 'Synonyms & Antonyms', subject: 'English' },
  'antonyms': { canonical: 'Synonyms & Antonyms', subject: 'English' },
  'vocab': { canonical: 'Synonyms & Antonyms', subject: 'English' },
  'vocabulary': { canonical: 'Synonyms & Antonyms', subject: 'English' },
  'idiom': { canonical: 'Idioms & Phrases', subject: 'English' },
  'idioms': { canonical: 'Idioms & Phrases', subject: 'English' },
  'phrases': { canonical: 'Idioms & Phrases', subject: 'English' },
  'one word': { canonical: 'One Word Substitution', subject: 'English' },
  'ows': { canonical: 'One Word Substitution', subject: 'English' },
  'substitution': { canonical: 'One Word Substitution', subject: 'English' },
  'cloze': { canonical: 'Cloze Test', subject: 'English' },
  'cloze test': { canonical: 'Cloze Test', subject: 'English' },
  'spelling': { canonical: 'Spelling Errors', subject: 'English' },
  'spelling error': { canonical: 'Spelling Errors', subject: 'English' },
  'spelling errors': { canonical: 'Spelling Errors', subject: 'English' },
  'incorrect spelling': { canonical: 'Spelling Errors', subject: 'English' },
  'misspelt': { canonical: 'Spelling Errors', subject: 'English' },
  'anto syno': { canonical: 'Synonyms & Antonyms', subject: 'English' },
  'syno anto': { canonical: 'Synonyms & Antonyms', subject: 'English' },
  'syno': { canonical: 'Synonyms & Antonyms', subject: 'English' },
  'anto': { canonical: 'Synonyms & Antonyms', subject: 'English' },
  'spotting error': { canonical: 'Spotting Errors', subject: 'English' },
  'spotting errors': { canonical: 'Spotting Errors', subject: 'English' },
  'common error': { canonical: 'Spotting Errors', subject: 'English' },
  'sentence improvement': { canonical: 'Sentence Improvement', subject: 'English' },
  'improvement': { canonical: 'Sentence Improvement', subject: 'English' },
  'para jumble': { canonical: 'Para Jumbles', subject: 'English' },
  'para jumbles': { canonical: 'Para Jumbles', subject: 'English' },
  'pqrs': { canonical: 'Para Jumbles', subject: 'English' },
  'reading comprehension': { canonical: 'Reading Comprehension', subject: 'English' },
  'comprehension': { canonical: 'Reading Comprehension', subject: 'English' },
  'rc': { canonical: 'Reading Comprehension', subject: 'English' },
  'english comprehension': { canonical: 'Reading Comprehension', subject: 'English' },

  // Quantitative Aptitude
  'trigo': { canonical: 'Trigonometry', subject: 'Mathematics' },
  'trigonometry': { canonical: 'Trigonometry', subject: 'Mathematics' },
  'height and distance': { canonical: 'Trigonometry', subject: 'Mathematics' },
  'geo': { canonical: 'Geometry', subject: 'Mathematics' },
  'geometry': { canonical: 'Geometry', subject: 'Mathematics' },
  'circle': { canonical: 'Geometry', subject: 'Mathematics' },
  'triangle': { canonical: 'Geometry', subject: 'Mathematics' },
  'mensuration': { canonical: 'Mensuration', subject: 'Mathematics' },
  'cylinder': { canonical: 'Mensuration', subject: 'Mathematics' },
  'algebra': { canonical: 'Algebra', subject: 'Mathematics' },
  'profit loss': { canonical: 'Profit and Loss', subject: 'Mathematics' },
  'profit and loss': { canonical: 'Profit and Loss', subject: 'Mathematics' },
  'p&l': { canonical: 'Profit and Loss', subject: 'Mathematics' },
  'pl': { canonical: 'Profit and Loss', subject: 'Mathematics' },
  'discount': { canonical: 'Profit and Loss', subject: 'Mathematics' },
  'percentage': { canonical: 'Percentage', subject: 'Mathematics' },
  'percent': { canonical: 'Percentage', subject: 'Mathematics' },
  'si ci': { canonical: 'Simple & Compound Interest', subject: 'Mathematics' },
  'sici': { canonical: 'Simple & Compound Interest', subject: 'Mathematics' },
  'compound interest': { canonical: 'Simple & Compound Interest', subject: 'Mathematics' },
  'simple interest': { canonical: 'Simple & Compound Interest', subject: 'Mathematics' },
  'ratio': { canonical: 'Ratio & Proportion', subject: 'Mathematics' },
  'ratio proportion': { canonical: 'Ratio & Proportion', subject: 'Mathematics' },
  'proportion': { canonical: 'Ratio & Proportion', subject: 'Mathematics' },
  'time and work': { canonical: 'Time and Work', subject: 'Mathematics' },
  'time work': { canonical: 'Time and Work', subject: 'Mathematics' },
  'work': { canonical: 'Time and Work', subject: 'Mathematics' },
  'pipe': { canonical: 'Pipes & Cisterns', subject: 'Mathematics' },
  'pipe and cistern': { canonical: 'Pipes & Cisterns', subject: 'Mathematics' },
  'speed distance': { canonical: 'Speed, Time and Distance', subject: 'Mathematics' },
  'time speed distance': { canonical: 'Speed, Time and Distance', subject: 'Mathematics' },
  'tsds': { canonical: 'Speed, Time and Distance', subject: 'Mathematics' },
  'train': { canonical: 'Speed, Time and Distance', subject: 'Mathematics' },
  'boat': { canonical: 'Speed, Time and Distance', subject: 'Mathematics' },
  'boat and stream': { canonical: 'Speed, Time and Distance', subject: 'Mathematics' },
  'average': { canonical: 'Average', subject: 'Mathematics' },
  'avg': { canonical: 'Average', subject: 'Mathematics' },
  'mixture': { canonical: 'Mixture & Alligation', subject: 'Mathematics' },
  'alligation': { canonical: 'Mixture & Alligation', subject: 'Mathematics' },
  'number system': { canonical: 'Number System', subject: 'Mathematics' },
  'divisibility': { canonical: 'Number System', subject: 'Mathematics' },

  // Reasoning
  'syllogism': { canonical: 'Syllogism', subject: 'Reasoning' },
  'syllog': { canonical: 'Syllogism', subject: 'Reasoning' },
  'analogy': { canonical: 'Analogy', subject: 'Reasoning' },
  'coding decoding': { canonical: 'Coding-Decoding', subject: 'Reasoning' },
  'coding': { canonical: 'Coding-Decoding', subject: 'Reasoning' },
  'blood relation': { canonical: 'Blood Relations', subject: 'Reasoning' },
  'blood relations': { canonical: 'Blood Relations', subject: 'Reasoning' },
  'missing number': { canonical: 'Missing Number / Series', subject: 'Reasoning' },
  'number series': { canonical: 'Missing Number / Series', subject: 'Reasoning' },
  'series': { canonical: 'Missing Number / Series', subject: 'Reasoning' },
  'direction': { canonical: 'Direction & Distance', subject: 'Reasoning' },
  'dice': { canonical: 'Cube & Dice', subject: 'Reasoning' },
  'cube': { canonical: 'Cube & Dice', subject: 'Reasoning' },
  'counting figure': { canonical: 'Counting Figures', subject: 'Reasoning' },
  'venn diagram': { canonical: 'Venn Diagram', subject: 'Reasoning' },

  // General Awareness
  'polity': { canonical: 'Polity', subject: 'General Awareness' },
  'constitution': { canonical: 'Polity', subject: 'General Awareness' },
  'article': { canonical: 'Polity', subject: 'General Awareness' },
  'articles': { canonical: 'Polity', subject: 'General Awareness' },
  'history': { canonical: 'History', subject: 'General Awareness' },
  'modern history': { canonical: 'History', subject: 'General Awareness' },
  'geography': { canonical: 'Geography', subject: 'General Awareness' },
  'economics': { canonical: 'Economics', subject: 'General Awareness' },
  'biology': { canonical: 'Biology', subject: 'General Awareness' },
  'physics': { canonical: 'Physics', subject: 'General Awareness' },
  'chemistry': { canonical: 'Chemistry', subject: 'General Awareness' },
  'static gk': { canonical: 'Static GK', subject: 'General Awareness' },
  'current affairs': { canonical: 'Current Affairs', subject: 'General Awareness' }
};

// ── 2. Lightweight Levenshtein Distance for Typo Resilience ──
export function levenshteinDistance(s1: string, s2: string): number {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

// ── 3. In-Memory Store (Cached Once per Server Instance) ──
export interface TargetMockMatch {
  mockId: string;
  title: string;
  platform?: string;
  filePath: string;
  targetSubject?: string;
  targetStatus?: string;
  targetQNum?: number;
}

class MockQuestionStore {
  private isInitialized = false;
  private topicMap = new Map<string, TopicIndexEntry>();
  private mockReports: MockScorecard[] = [];
  private mockRegistry: Array<{ id: string; title: string; platform?: string; filePath: string }> = [];
  private mockTestsCache = new Map<string, any[]>();
  private allQuestionsCount = 0;

  public initialize(cwd = process.cwd(), force = false): void {
    if (this.isInitialized && !force) return;
    if (force) {
      this.topicMap.clear();
      this.mockReports = [];
      this.mockRegistry = [];
      this.mockTestsCache.clear();
      this.allQuestionsCount = 0;
      this.isInitialized = false;
    }
    try {
      const errorDir = path.join(cwd, 'src', 'data', 'mock_errors');
      const testsDir = path.join(cwd, 'src', 'data', 'mock_questions');
      const reportsFile = path.join(cwd, 'src', 'data', 'mock_reports.json');

      const seenFingerprints = new Set<string>();

      const addRecord = (q: any, defaultSubject = 'General') => {
        const text = (q.question || q.questionText || '').trim();
        if (!text) return;
        const fingerprint = (q.id || `${text.slice(0, 60)}_${q.q_num || q.questionNumber || ''}`).toLowerCase();
        if (seenFingerprints.has(fingerprint)) return;
        seenFingerprints.add(fingerprint);
        this.allQuestionsCount++;

        const subject = q.subject || defaultSubject;
        let rawTopic = (q.topic || q.tags?.topic || 'General').trim();
        if (rawTopic.toLowerCase() === 'english comprehension' || rawTopic.toLowerCase() === 'english') {
          const rawSub = (q.subtopic || q.tags?.subtopic || '').trim();
          if (rawSub && rawSub.toLowerCase() !== 'english comprehension' && rawSub.toLowerCase() !== 'english') {
            rawTopic = rawSub;
          }
        }
        const subtopic = (q.subtopic || q.tags?.subtopic || rawTopic).trim();
        const concept = (q.conceptTested || q.tags?.conceptTested || '').trim();
        const status = (q.status || '').toLowerCase();
        const isSlow = status.includes('slow');
        const isUnattempted = status.includes('unattempted') || status.includes('skipped');
        const isWrong = status.includes('wrong') || status.includes('incorrect') || (!isSlow && !isUnattempted && !status.includes('correct'));

        if (!isWrong && !isSlow && !isUnattempted) return;

        const topicKey = rawTopic.toLowerCase();
        if (!this.topicMap.has(topicKey)) {
          this.topicMap.set(topicKey, {
            topic: rawTopic,
            subject,
            totalErrors: 0,
            wrongCount: 0,
            slowCount: 0,
            unattemptedCount: 0,
            conceptsTested: new Set(),
            rcaCounts: {},
            sampleErrors: []
          });
        }

        const entry = this.topicMap.get(topicKey)!;
        entry.totalErrors++;
        if (isWrong) entry.wrongCount++;
        if (isSlow) entry.slowCount++;
        if (isUnattempted) entry.unattemptedCount++;
        if (concept && concept.length > 2) entry.conceptsTested.add(concept);

        const rcaTag = q.rca?.tag || (q.tags as any)?.rcaTag;
        if (rcaTag) entry.rcaCounts[rcaTag] = (entry.rcaCounts[rcaTag] || 0) + 1;

        if (entry.sampleErrors.length < 4) {
          entry.sampleErrors.push({
            id: q.id,
            testName: q.testName || q.test_name,
            platform: q.platform,
            qNum: q.q_num || q.questionNumber,
            subject,
            topic: rawTopic,
            subtopic,
            conceptTested: concept,
            status: q.status,
            chosenOption: q.chosenOption || q.userAnswer || q.selectedAnswer,
            correctOption: q.correctOption || q.answer,
            userTime: q.userTime || q.user_time || q.timeSpent,
            avgTime: q.avgTime || q.avg_time,
            rcaTag,
            question: text,
            options: q.options,
            solution: q.solution
          });
        }
      };

      // 1. Ingest mock_errors
      if (fs.existsSync(errorDir)) {
        const errorFiles = ['english.json', 'mathematics.json', 'reasoning.json', 'general_awareness.json'];
        for (const file of errorFiles) {
          const p = path.join(errorDir, file);
          if (fs.existsSync(p)) {
            try {
              const chapters = JSON.parse(fs.readFileSync(p, 'utf8'));
              for (const ch of chapters) {
                for (const q of ch.questions || []) {
                  addRecord(q, ch.subject || file.replace('.json', ''));
                }
              }
            } catch {}
          }
        }
      }

      // 2. Ingest mock_questions
      if (fs.existsSync(testsDir)) {
        const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try {
            const list = JSON.parse(fs.readFileSync(path.join(testsDir, file), 'utf8'));
            for (const item of list) {
              addRecord(item, item.subject || 'General');
            }
          } catch {}
        }
      }

      // 3. Ingest mock reports & build mockRegistry
      if (fs.existsSync(reportsFile)) {
        try {
          this.mockReports = JSON.parse(fs.readFileSync(reportsFile, 'utf8'));
          for (const rep of this.mockReports) {
            const cp = path.join(testsDir, `${rep.id}.json`);
            if (fs.existsSync(cp)) {
              this.mockRegistry.push({
                id: rep.id,
                title: rep.title,
                platform: (rep as any).platform,
                filePath: cp
              });
            }
          }
        } catch {}
      }

      // Also ensure all test files in mock_questions are registered
      if (fs.existsSync(testsDir)) {
        const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.json'));
        for (const file of testFiles) {
          const id = file.replace('.json', '');
          if (!this.mockRegistry.some(m => m.id === id)) {
            this.mockRegistry.push({
              id,
              title: id,
              filePath: path.join(testsDir, file)
            });
          }
        }
      }

      this.isInitialized = true;
    } catch (e) {
      console.error('[MockQuestionStore Init Error]:', e);
    }
  }

  // Find a topic by exact match, alias, or fuzzy Levenshtein
  public findTopic(rawQuery: string): TopicIndexEntry | null {
    let qLower = (rawQuery || '').toLowerCase().trim();
    if (!qLower) return null;

    // Normalization for common student slang / abbreviations / typos
    qLower = qLower
      .replace(/\bp&l\b/g, 'profit and loss')
      .replace(/\bpl\b/g, 'profit and loss')
      .replace(/\bsici\b/g, 'simple & compound interest')
      .replace(/\bsi\s*ci\b/g, 'simple & compound interest')
      .replace(/\bactve\b/g, 'active')
      .replace(/\bpasive\b/g, 'passive')
      .replace(/\btrigonomtry\b/g, 'trigonometry')
      .replace(/\bgeometrey\b/g, 'geometry')
      .replace(/\bpersentage\b/g, 'percentage')
      .replace(/\bparcentage\b/g, 'percentage')
      .replace(/\bsylogism\b/g, 'syllogism')
      .replace(/\bsilogism\b/g, 'syllogism');

    // A. Check Alias dictionary directly (exact phrase substring)
    for (const [alias, data] of Object.entries(TOPIC_ALIASES)) {
      if (qLower.includes(alias)) {
        const direct = this.topicMap.get(data.canonical.toLowerCase());
        if (direct) return direct;
        // Even if candidate has 0 errors in this topic yet, return canonical topic metadata!
        return {
          topic: data.canonical,
          subject: data.subject,
          totalErrors: 0,
          wrongCount: 0,
          slowCount: 0,
          unattemptedCount: 0,
          conceptsTested: new Set(),
          rcaCounts: {},
          sampleErrors: []
        };
      }
    }

    // B. Check exact topic names in store
    for (const [tKey, entry] of this.topicMap.entries()) {
      if (qLower.includes(tKey)) {
        return entry;
      }
    }

    // C. Fuzzy Matching on tokens
    // Safe thresholds:
    // length <= 4: exact match only
    // length 5: distance <= 1
    // length >= 6: distance <= 2
    const tokens = qLower.split(/[^a-z0-9]+/).filter(w => w.length >= 4);

    for (const token of tokens) {
      const maxAllowedDist = token.length <= 4 ? 0 : token.length <= 5 ? 1 : 2;

      // Check against aliases
      for (const [alias, data] of Object.entries(TOPIC_ALIASES)) {
        if (alias.includes(' ')) continue; // skip multi-word aliases here
        if (Math.abs(token.length - alias.length) > maxAllowedDist) continue;
        const d = levenshteinDistance(token, alias);
        if (d <= maxAllowedDist) {
          const direct = this.topicMap.get(data.canonical.toLowerCase());
          if (direct) return direct;
          return {
            topic: data.canonical,
            subject: data.subject,
            totalErrors: 0,
            wrongCount: 0,
            slowCount: 0,
            unattemptedCount: 0,
            conceptsTested: new Set(),
            rcaCounts: {},
            sampleErrors: []
          };
        }
      }

      // Check against stored topics
      for (const [tKey, entry] of this.topicMap.entries()) {
        const tTokens = tKey.split(/[^a-z0-9]+/).filter(w => w.length >= 4);
        for (const tt of tTokens) {
          if (Math.abs(token.length - tt.length) > maxAllowedDist) continue;
          const d = levenshteinDistance(token, tt);
          if (d <= maxAllowedDist) {
            return entry;
          }
        }
      }
    }

    return null;
  }

  // Get Top N Weakest Topics overall
  public getTopWeakTopics(limit = 4): TopicIndexEntry[] {
    return Array.from(this.topicMap.values())
      .sort((a, b) => b.totalErrors - a.totalErrors)
      .slice(0, limit);
  }

  // Get latest mock scorecard summary
  public getLatestMockScorecard(): MockScorecard | null {
    if (this.mockReports.length === 0) return null;
    return this.mockReports[0];
  }

  // Get recent N mock scorecards for trend analysis
  public getRecentMockScorecards(limit = 3): MockScorecard[] {
    return this.mockReports.slice(0, limit);
  }

  // Get full questions list for a specific mock test
  public getMockQuestions(mockId: string): any[] {
    if (this.mockTestsCache.has(mockId)) {
      return this.mockTestsCache.get(mockId)!;
    }
    const entry = this.mockRegistry.find(m => m.id === mockId);
    if (!entry || !fs.existsSync(entry.filePath)) {
      return [];
    }
    try {
      const data = JSON.parse(fs.readFileSync(entry.filePath, 'utf8'));
      const list = Array.isArray(data) ? data : [];
      this.mockTestsCache.set(mockId, list);
      return list;
    } catch {
      return [];
    }
  }

  // Find a mock by natural user query (e.g. "test 7", "mock 3", "sectional 2")
  public findMockByQuery(
    userQuery: string,
    fallbackMockId?: string,
    fallbackMockTitle?: string
  ): TargetMockMatch | null {
    const qLower = (userQuery || '').toLowerCase().trim();
    if (!qLower) return null;

    // 1. Detect target subject / section
    let targetSubject: string | undefined = undefined;
    if (/(english|comprehension|cloze|vocab|vocabulary|grammar|para\s*jumble|synonym|antonym|spelling|idiom|reading)/i.test(qLower)) {
      targetSubject = 'English';
    } else if (/(math|maths|mathematics|quant|quantitative|arithmetic|advance|trigo|geometry|algebra|number system)/i.test(qLower)) {
      targetSubject = 'Mathematics';
    } else if (/(reasoning|gi|general intelligence|logical|logic|syllogism|analogy|coding|puzzle|dice)/i.test(qLower)) {
      targetSubject = 'Reasoning';
    } else if (/(gk|gs|ga|general awareness|general studies|current affairs|history|polity|science|economics|geography)/i.test(qLower)) {
      targetSubject = 'General Awareness';
    }

    // 2. Detect target status
    let targetStatus: string | undefined = undefined;
    if (/(wrong|incorrect|mistake|galti|loss)/i.test(qLower)) {
      targetStatus = 'wrong';
    } else if (/(slow|time trap|timeout)/i.test(qLower)) {
      targetStatus = 'slow';
    } else if (/(unattempted|skipped|left|chhod)/i.test(qLower)) {
      targetStatus = 'unattempted';
    }

    // 3. Question number in mock (e.g. 'question 19', 'q#19')
    const qNumMatch = qLower.match(/\b(?:question|q)\s*#?\s*(\d+)\b/i);
    const targetQNum = qNumMatch ? parseInt(qNumMatch[1], 10) : undefined;

    // 4. Test / Mock number detection (e.g. "test 7", "mock 7", "7th mock", "full test 7")
    const numMatch =
      qLower.match(/(?:test|mock|full test|full mock|tier\s*i|ft|sectional)\s*[-:#]?\s*(\d+)/i) ||
      qLower.match(/(\d+)(?:st|nd|rd|th)?\s*(?:mock|test)/i) ||
      qLower.match(/(?:test|mock)\s*(\d+)/i);

    const testNum = numMatch ? parseInt(numMatch[1], 10) : null;

    if (testNum !== null) {
      const isSectional = /sectional/i.test(qLower);
      const candidates = this.mockRegistry.filter(r => {
        const rLower = r.title.toLowerCase();
        const numInTitle = rLower.match(/[-:]\s*(\d+)/) || rLower.match(/\btest\s*-\s*(\d+)/);
        return numInTitle && parseInt(numInTitle[1], 10) === testNum;
      });

      if (candidates.length > 0) {
        const preferred = isSectional
          ? candidates.find(r => r.title.toLowerCase().includes('sectional'))
          : candidates.find(r => !r.title.toLowerCase().includes('sectional'));
        const matched = preferred || candidates[0];
        return {
          mockId: matched.id,
          title: matched.title,
          platform: matched.platform,
          filePath: matched.filePath,
          targetSubject,
          targetStatus,
          targetQNum
        };
      }
    }

    // 5. Check named mock phrases (e.g., 'live test', 'mega live', 'officer friday')
    if (/live test|mega live|officer/i.test(qLower)) {
      const matched = this.mockRegistry.find(r =>
        r.title.toLowerCase().includes('live test') || r.title.toLowerCase().includes('mega live')
      );
      if (matched) {
        return {
          mockId: matched.id,
          title: matched.title,
          platform: matched.platform,
          filePath: matched.filePath,
          targetSubject,
          targetStatus,
          targetQNum
        };
      }
    }

    // 6. Fallback to active mock if candidate asks about the currently opened test
    if (fallbackMockId) {
      const isAskingForQuestions = /(question|quesito|problem|sawal|cloze|passage|review|mistake|wrong|slow)/i.test(qLower);
      if (isAskingForQuestions || targetSubject) {
        const matched = this.mockRegistry.find(r => r.id === fallbackMockId);
        if (matched) {
          return {
            mockId: matched.id,
            title: fallbackMockTitle || matched.title,
            platform: matched.platform,
            filePath: matched.filePath,
            targetSubject,
            targetStatus,
            targetQNum
          };
        }
      }
    }

    return null;
  }
}

export const globalStore = new MockQuestionStore();

// ── 4. User Intent Detection ──
export type UserIntent =
  | 'GREETING'
  | 'SPECIFIC_QUESTION'
  | 'MOCK_TEST_QUESTIONS'
  | 'TOPIC_FOCUS'
  | 'FULL_MOCK'
  | 'OVERALL_WEAKNESS'
  | 'GENERAL';

export function detectUserIntent(
  userText: string,
  fallbackMockId?: string,
  fallbackMockTitle?: string
): {
  intent: UserIntent;
  matchedTopic?: TopicIndexEntry | null;
  targetQNum?: number | null;
  mockCount?: number;
  targetMock?: TargetMockMatch | null;
} {
  const text = (userText || '').trim();
  const lower = text.toLowerCase();

  // 1. Greeting or casual small talk
  const isGreeting =
    /^(hi|hello|hey|good\s*(morning|evening|afternoon)|namaste|hola|tomy|tommy|sup|ok|okay|k|thanks|thank you|thx)\b/i.test(lower) ||
    lower === 'hi' ||
    lower === 'hello' ||
    lower === 'hey' ||
    (lower.length <= 4 && !/\d/.test(lower));

  if (isGreeting && lower.split(/\s+/).length <= 4) {
    return { intent: 'GREETING' };
  }

  // 2. Specific Mock Test Query (e.g. "give all the quesito of the test 7 of english", "test 3 cloze", "mock 5 math wrong")
  globalStore.initialize();
  const targetMock = globalStore.findMockByQuery(lower, fallbackMockId, fallbackMockTitle);
  const isAskingForMockQuestions =
    targetMock &&
    (/(question|quesito|problem|sawal|all|show|give|list|tell|explain|review|passage|cloze|solve|wrong|mistake|slow|unattempted|test|mock)/i.test(lower) ||
      targetMock.targetSubject !== undefined ||
      targetMock.targetQNum !== undefined);

  if (targetMock && isAskingForMockQuestions) {
    return {
      intent: 'MOCK_TEST_QUESTIONS',
      targetMock,
      targetQNum: targetMock.targetQNum
    };
  }

  // 3. Specific question review in general (e.g. "question 14")
  const qNumMatch = lower.match(/\b(?:question|q)\s*#?\s*(\d+)\b/i) || lower.match(/#(\d+)\b/);
  if (qNumMatch) {
    return { intent: 'SPECIFIC_QUESTION', targetQNum: parseInt(qNumMatch[1], 10) };
  }

  // 4. Multi-Mock / Full Mock / Trend Analysis (e.g. "analyse last 3 mock", "compare mocks", "latest test")
  const mockCountMatch = lower.match(/\b(?:last|past|recent)\s*(\d+)\s*mocks?\b/i);
  const requestedMockCount = mockCountMatch ? parseInt(mockCountMatch[1], 10) : (
    /\b(all mocks?|mock history|compare mocks)\b/i.test(lower) ? 5 : 1
  );

  if (
    mockCountMatch ||
    /\b(full mock|mock test|mock report|test score|latest mock|my marks|my score|latest test|last mock|past mock|recent mock|mock history|compare mocks)\b/i.test(lower) ||
    (/\bmocks?\b/i.test(lower) && /\b(analyse|analyze|trend|score|performance|report)\b/i.test(lower))
  ) {
    return { intent: 'FULL_MOCK', mockCount: requestedMockCount };
  }

  // 5. Overall Weakness diagnosis
  if (/\b(weak|weakness|mistake|kaha galti|marks nahi|score kaise|plateau|diagnose|improve score)\b/i.test(lower)) {
    return { intent: 'OVERALL_WEAKNESS' };
  }

  // 6. Topic Focus (Fuzzy / Alias search)
  const matchedTopic = globalStore.findTopic(lower);
  if (matchedTopic) {
    return { intent: 'TOPIC_FOCUS', matchedTopic };
  }

  return { intent: 'GENERAL' };
}

// ── 5. Compact Question Formatter for Prompts (Token Efficient) ──
function formatMockQuestionForPrompt(q: any, index: number): string {
  const qNum = q.questionNumber || (q.q_num ? `Question ${q.q_num}` : `Q#${index + 1}`);
  const topic = q.topic || q.tags?.topic || 'General';
  const subtopic = q.subtopic || q.tags?.subtopic || '';
  const status = (q.status || 'attempted').toUpperCase();
  const userAns = q.chosenOption || q.userAnswer || q.selectedAnswer || 'Unattempted';
  const correctAns = q.correctOption || q.answer || '';

  let optionsStr = '';
  if (q.options && typeof q.options === 'object') {
    optionsStr = Object.entries(q.options)
      .map(([k, v]) => `(${k.toUpperCase()}) ${v}`)
      .join('  ');
  }

  // Clean solution text: remove redundant headers and shorten overly long passage repeats
  let solText = (q.solution || '').trim();
  solText = solText.replace(/^Solution\s*/i, '').trim();
  if (solText.length > 450) {
    solText = solText.slice(0, 450) + '...';
  }

  const qText = (q.questionText || q.question || '').trim();

  return `[${qNum}] Topic: ${topic}${subtopic ? ` (${subtopic})` : ''} | Status: ${status} | Candidate Choice: ${userAns} | Correct Answer: ${correctAns}
Question: ${qText}
${optionsStr ? `Options: ${optionsStr}\n` : ''}Key Solution / Concept: ${solText || 'None provided'}`;
}

// ── 6. Selective Context Builder (Token Optimizer) ──
export function buildSelectiveContext(params: {
  userText: string;
  activeQuestion?: any;
  activeMockContext?: string;
  activeMockId?: string;
  activeMockTitle?: string;
}): string {
  globalStore.initialize();
  const { intent, matchedTopic, targetQNum, mockCount, targetMock } = detectUserIntent(
    params.userText,
    params.activeMockId,
    params.activeMockTitle
  );

  // Case A: Greeting -> 0 extra context tokens!
  if (intent === 'GREETING') {
    return '';
  }

  // Case B: Specific Mock Test Questions (Authentic Data Retrieval)
  if (intent === 'MOCK_TEST_QUESTIONS' && targetMock) {
    const rawQuestions = globalStore.getMockQuestions(targetMock.mockId);

    if (rawQuestions.length === 0) {
      return `\n--- MOCK TEST CONTEXT: ${targetMock.title} ---
No detailed question bank file found for ${targetMock.title}. Please notify the student that only the high-level scorecard is available for this test.
`;
    }

    // Sub-case 1: Specific question requested (e.g. Q#17)
    if (targetMock.targetQNum !== undefined) {
      const qNum = targetMock.targetQNum;
      const matchedQ = rawQuestions.find(q => {
        if (q.q_num === qNum) return true;
        const qn = String(q.questionNumber || '').toLowerCase();
        return qn.includes(`question ${qNum}`) || qn.includes(`q ${qNum}`) || qn === String(qNum);
      });

      if (matchedQ) {
        return `\n--- AUTHENTIC TEST QUESTION: ${targetMock.title} [Question #${qNum}] ---
${formatMockQuestionForPrompt(matchedQ, 0)}

CRITICAL SYSTEM MANDATE:
1. The question above is the candidate's ACTUAL, REAL question #${qNum} from "${targetMock.title}".
2. You MUST strictly base your answer on THIS authentic question. NEVER invent questions or borrow from another test.
3. Provide a motivating, elite breakdown explaining why the correct answer is right and tactical elimination steps.
`;
      }
    }

    // Sub-case 2: Section or all questions requested
    let filtered = rawQuestions;

    if (targetMock.targetSubject) {
      const subLower = targetMock.targetSubject.toLowerCase();
      filtered = filtered.filter(q => {
        const qSub = (q.subject || q.section || '').toLowerCase();
        if (subLower.includes('eng')) return qSub.includes('eng');
        if (subLower.includes('math') || subLower.includes('quant')) return qSub.includes('math') || qSub.includes('quant');
        if (subLower.includes('reason')) return qSub.includes('reason') || qSub.includes('intelligence');
        if (subLower.includes('aware') || subLower.includes('gk') || subLower.includes('gs')) return qSub.includes('aware') || qSub.includes('gk') || qSub.includes('general');
        return qSub.includes(subLower);
      });
    }

    if (targetMock.targetStatus) {
      const stLower = targetMock.targetStatus.toLowerCase();
      filtered = filtered.filter(q => {
        const qSt = (q.status || '').toLowerCase();
        if (stLower === 'wrong') return qSt.includes('wrong') || qSt.includes('incorrect');
        if (stLower === 'slow') return qSt.includes('slow');
        if (stLower === 'unattempted') return qSt.includes('unattempted') || qSt.includes('skipped');
        return true;
      });
    }

    // Token limit: Cap at 25 questions per section (standard SSC section size)
    const questionsToInclude = filtered.slice(0, 25);

    const questionsBlock = questionsToInclude
      .map((q, idx) => formatMockQuestionForPrompt(q, idx))
      .join('\n\n---\n\n');

    const subjectLabel = targetMock.targetSubject ? `${targetMock.targetSubject.toUpperCase()} SECTION` : 'AUTHENTIC TEST QUESTIONS';

    return `\n--- VERIFIED AUTHENTIC TEST DATA: ${targetMock.title} [${subjectLabel}] ---
Total genuine questions provided: ${questionsToInclude.length} (out of ${filtered.length} matching in test)

${questionsBlock}

CRITICAL SYSTEM MANDATE FOR TOMMY:
1. The questions listed above are the candidate's ACTUAL, REAL questions from "${targetMock.title}".
2. You MUST strictly base your answer on THESE genuine questions.
3. NEVER make up or fabricate questions. NEVER substitute questions from a different mock test.
4. When presenting the questions:
   - Clearly cite each Question Number and Topic.
   - Quote the question text/sentence and correct option.
   - Provide "Tommy's Breakdown": A concise, sharp conceptual explanation of the grammar rule, formula, or elimination trick.
   - If there are remaining questions, let the candidate know they can ask for further questions or deep dives.
`;
  }

  // Case C: Single Active Question (from 'Ask AI' button or user asking for Q#N)
  if (params.activeQuestion) {
    const q = params.activeQuestion;
    const sourceTag = q.sourceLabel
      ? `\nQuestion Origin: ${q.sourceLabel}`
      : (q.sourceType ? `\nQuestion Origin: ${q.sourceType === 'full_mock' ? 'Full Mock Test' : q.sourceType === 'sectional' ? 'Sectional Test' : 'Subject-Wise Error Bank'}` : '');

    const rcaTag = q.rcaTag || q.rca?.tag;
    const rcaTagName = q.rcaTagName || q.rca?.tagName;
    const sillyNote = q.sillyMistakeNote;
    const rcaMode = q.rcaMode;

    let rcaHeader = '';
    let rcaMandate = '2. Provide a motivating, elite breakdown of why the correct option is right, why the candidate\'s choice failed, and a 30-second elimination shortcut.';

    if (rcaTag || rcaMode === 'rca') {
      const displayTag = rcaTag === 'A' ? 'S' : rcaTag;
      const displayTagName = rcaTagName || (displayTag === 'C' ? 'Conceptual Gap' : displayTag === 'S' ? 'Silly Mistake' : displayTag === 'T' ? 'Time / Speed Issue' : displayTag === 'G' ? 'Wild Guess' : 'Root Cause Analysis');
      rcaHeader = `\nRCA Mode: Active\nRCA Classification: [${displayTag || 'Unclassified'}] ${displayTagName}`;
      if (sillyNote) {
        rcaHeader += `\nCandidate Silly Mistake Note: "${sillyNote}"`;
      }

      if (displayTag === 'C') {
        rcaMandate = `2. RCA MANDATE [CONCEPT GAP]: The candidate identified a core conceptual gap in this topic.
   - Teach the underlying theorem, formula, or grammar rule from first principles.
   - Explain why candidate's choice was a conceptual misunderstanding.
   - Provide a foolproof 3-step solving blueprint and a 30-second shortcut.`;
      } else if (displayTag === 'S') {
        rcaMandate = `2. RCA MANDATE [SILLY MISTAKE]: The candidate already knew the concept but made a careless slip${sillyNote ? ` (recorded note: "${sillyNote}")` : ''}.
   - Directly analyze the cognitive trap or deceptive wording in this question.
   - Explain why candidate's choice looked tempting and why the slip occurred.
   - Give a strict 5-second verification protocol before marking in the exam.`;
      } else if (displayTag === 'T') {
        rcaMandate = `2. RCA MANDATE [TIME / SPEED ISSUE]: The candidate struggled with time or solving speed.
   - Skip long traditional derivations.
   - Provide rapid topper techniques: unit digit, digital sum, ratio scaling, or option elimination.
   - Show how to solve this in under 20-30 seconds flat.`;
      } else if (displayTag === 'G') {
        rcaMandate = `2. RCA MANDATE [WILD GUESS]: The candidate guessed without complete certainty.
   - Teach how an SSC CGL topper eliminates 2-3 trap options using question constraints, extreme values, or option symmetry.
   - Provide the complete solution and memory trick.`;
      }
    }

    return `\n--- ACTIVE QUESTION REVIEW CONTEXT (Question #${q.qNum || q.questionNumber || targetQNum || '1'})${sourceTag}${rcaHeader} ---
Topic: ${q.topic || 'General'}${q.subtopic ? ` → ${q.subtopic}` : ''}
${q.conceptTested ? `Concept Tested: ${q.conceptTested}\n` : ''}Question: ${q.question || q.questionText}
Options: ${JSON.stringify(q.options || {})}
Candidate Choice: ${q.userAnswer || q.chosenOption || 'Unattempted'}
Correct Answer: ${q.correctAnswer || q.correctOption || 'Refer to solution'}
Official Solution:
${q.solution || 'No solution provided'}

SYSTEM MANDATE FOR TOMMY:
1. Clearly specify the origin of this question (Full Mock Test, Sectional Test, or Subject-Wise Practice) in your opening statement.
${rcaMandate}
`;
  }

  // Case D: Topic Focus -> Pull ONLY that topic's candidate mistakes
  if (intent === 'TOPIC_FOCUS' && matchedTopic) {
    if (matchedTopic.totalErrors === 0) {
      return `\n--- TARGETED TOPIC FOCUS: [${matchedTopic.subject.toUpperCase()} → ${matchedTopic.topic}] ---
Candidate has 0 recorded errors in this topic in current mock history.
Instruction: Focus your response specifically on teaching the core concepts, grammar/math rules, formulas, pattern-matching shortcuts, and high-frequency SSC CGL question types for ${matchedTopic.topic}.
`;
    }

    const conceptsList = Array.from(matchedTopic.conceptsTested).slice(0, 5).join('; ');
    const sampleErrorsStr = matchedTopic.sampleErrors.map((e, idx) => `
[Sample Mistake #${idx + 1}]
Question: ${e.question}
Options: ${JSON.stringify(e.options || {})}
Your Answer: ${e.chosenOption || 'Unattempted'} | Correct: ${e.correctOption}
Time Spent: ${e.userTime || 'N/A'} (Avg: ${e.avgTime || 'N/A'})
Official Solution / Explanation:
${e.solution || 'N/A'}
`).join('\n');

    return `\n--- TARGETED CANDIDATE PERFORMANCE IN [${matchedTopic.subject.toUpperCase()} → ${matchedTopic.topic}] ---
Candidate Errors in this topic: ${matchedTopic.totalErrors} (Wrong: ${matchedTopic.wrongCount}, Slow: ${matchedTopic.slowCount}, Skipped: ${matchedTopic.unattemptedCount})
${conceptsList ? `Key Concepts/Rules Failed: ${conceptsList}\n` : ''}
${sampleErrorsStr}
Instruction: Provide concept clarity, grammar/formula rules, shortcuts, and explain candidate mistakes in this topic.
`;
  }

  // Case E: Multi-Mock Query / Trend Analysis / Full Mock Scorecard
  if (intent === 'FULL_MOCK') {
    const count = mockCount && mockCount > 1 ? mockCount : 1;
    const recentMocks = globalStore.getRecentMockScorecards(count);

    if (recentMocks.length > 0) {
      if (recentMocks.length === 1) {
        const latest = recentMocks[0];
        return `\n--- CANDIDATE LATEST MOCK SCORECARD ---
Title: ${latest.title}
Score: ${latest.totalScore}/${latest.maxMarks} (Accuracy: ${latest.overallAccuracy || 'N/A'}%)
Correct: ${latest.totalCorrect} | Wrong: ${latest.totalWrong} | Skipped: ${latest.totalUnattempted}
Section Scores: ${JSON.stringify(latest.sections || {})}
Instruction: Analyze time management, score bottlenecks, and cutoff readiness based on this scorecard.
`;
      } else {
        const mockBreakdowns = recentMocks.map((m, idx) => {
          const secSummary = m.sections
            ? Object.entries(m.sections)
                .map(([sec, data]: [string, any]) => `${sec.toUpperCase()}: ${data.score ?? 'N/A'}/${data.total ? data.total * 2 : 50} (Acc: ${data.accuracy ?? 'N/A'}%)`)
                .join(' | ')
            : 'N/A';

          return `[Mock #${idx + 1}: ${m.title}]
Date: ${m.date ? new Date(m.date).toLocaleDateString() : 'Recent'} | Total Score: ${m.totalScore}/${m.maxMarks} (Accuracy: ${m.overallAccuracy || 'N/A'}%)
Correct: ${m.totalCorrect} | Wrong: ${m.totalWrong} | Skipped: ${m.totalUnattempted}
Section Scores: ${secSummary}`;
        }).join('\n\n');

        return `\n--- CANDIDATE LAST ${recentMocks.length} MOCKS COMPARISON & SCORE TREND ---
${mockBreakdowns}

Instruction:
1. Compare sectional performance and score trajectory across these ${recentMocks.length} mocks (which sections are rising vs dropping).
2. Point out the exact mark-leakage bottleneck across tests.
3. Recommend 2-3 high-impact tactical adjustments for the next mock.
`;
      }
    }
  }

  // Case F: Overall Weakness Query -> Pull top 3 weak areas
  if (intent === 'OVERALL_WEAKNESS') {
    const topWeak = globalStore.getTopWeakTopics(3);
    if (topWeak.length > 0) {
      const summary = topWeak.map((t, idx) => 
        `#${idx + 1} [${t.subject}] ${t.topic}: ${t.totalErrors} errors (Wrong: ${t.wrongCount}, Slow: ${t.slowCount}) | Concepts: ${Array.from(t.conceptsTested).slice(0, 3).join(', ')}`
      ).join('\n');

      return `\n--- CANDIDATE TOP WEAKNESS BRIEFING ---
${summary}
Instruction: Guide candidate on how to convert these specific weaknesses into strengths.
`;
    }
  }

  // Default: General intent, minimal background context
  return '';
}


const SYSTEM_INSTRUCTION = `You are "Tommy", an elite, analytical, highly encouraging study assistant and exam coach built directly into the candidate's CGL Preparation Portal.

YOUR CORE EXPERTISE:
1. SSC CGL Exam Pattern & Syllabus:
   - Tier 1: 4 sections (Reasoning, General Awareness, Quantitative Aptitude, English Comprehension). 25 questions each, 50 marks each (Total 200 marks, 60 minutes). Marking: +2 for correct, -0.5 for wrong. Cutoff targets: 145-160+ for UR category safety.
   - Tier 2: Mathematical Abilities (30 Qs), Reasoning (30 Qs), English (45 Qs), General Awareness (25 Qs), Computer Knowledge (20 Qs qualifying), plus Data Entry Speed Test. Marking: +3 for correct, -1 for wrong.
   - Subject mastery: Arithmetic & Advanced Maths formulas/shortcuts, English grammar rules (voice, narration, tense, subject-verb agreement) & vocab roots, Reasoning logical patterns & matrices, and high-yielding GK/GS areas (Polity, History, Science, Geography, Economics, Static GK).

3. REAL MOCK TEST CONTEXT & QUESTION SOLUTIONS:
   When targeted performance context or specific question context is provided:
   - Quote or reference the exact question and solution steps.
   - Break down the mathematical formula or English grammar rule.
   - Point out why the student's chosen option was wrong and how to eliminate incorrect options in under 30 seconds.
   - If the mistake is tagged as a Silly Mistake [A] or Time/Ego Trap [T], acknowledge their specific habit (e.g. calculation speed panic, misreading keywords) and give them an actionable habit fix to avoid repeating it.

4. TOPIC & CONCEPT WEAKNESS DIAGNOSIS:
   When the candidate asks what concepts they are weak in, where they are losing marks, or for a diagnosis:
   - Ground your analysis strictly in their provided performance data.
   - Name the exact Subject, Topic, Subtopic, and specific Missed Concepts/Rules.
   - Organize diagnosis using 3 Tiers:
     * ❌ Tier 1 — INCORRECT (Wrong answers): missed concept/rule + 1-line fix.
     * ⏱ Tier 2 — CORRECT (Slow): shortcut/pattern trick to solve under 45s.
     * ⬜ Tier 3 — UNATTEMPTED (Skipped): smart skip vs avoidable skip.

HOW TO ANSWER:
- Be direct, strategic, highly motivating, and analytical.
- When explaining mathematical or reasoning questions, clearly demonstrate the conceptual approach followed by shortcut tricks or elimination methods.
- For English questions, explain the underlying grammatical rule or contextual vocabulary clue.
- For casual greetings ("hi", "hello"), respond warmly, briefly, and ask what they would like to master today. Do not overwhelm them with stats unless asked!
- STRICT ENGLISH LANGUAGE REQUIREMENT: You must communicate and answer strictly and exclusively in clear, professional, and motivating English at all times. Do NOT use Hindi words, Devanagari script, or Hinglish. Every explanation, breakdown, and greeting must be in standard English.
- DO NOT append unsolicited practice drill cards, [DRILL: ...] tags, or drill recommendations. Keep answers focused strictly on clear explanation and exam mastery.
- MATHEMATICAL & TEXT FORMATTING RULES:
  * STRICT LATEX RULE: For ALL mathematical formulas, expressions, variables, units, equations, and algebra, ALWAYS enclose them in single dollar signs for inline math (e.g. $CSA = 2\pi rh$, $h = 2r$, $r = 14\text{ m}$, $784\pi\text{ m}^2$, $x^2 + y^2 = r^2$, $\left(\frac{x}{10}\right)^2\%$) or double dollar signs for display equations ($$\text{Area} = \frac{1}{2} \times b \times h$$).
  * NEVER write "textleft" or "textright" — always write standard LaTeX like $\left(\frac{x}{10}\right)^2\%$.
  * In LaTeX math, always escape percentage signs with a backslash (\%), e.g., $\left(\frac{x}{10}\right)^2\%$.
  * NEVER write raw LaTeX backslash commands (such as \pi, \times, \frac, \sqrt, \text, \left, \right) outside of $ or $$.
  * NEVER escape dollar signs with backslashes (write $, never \$).
  * NEVER leave mathematical expressions unclosed; always pair every opening $ with its closing $.
  * For arithmetic expressions or plain numbers, clean unicode symbols (×, ÷, ±, →, °) are also great.
- VISUAL CALLOUT CARDS:
  Use blockquotes with clear emojis and bold labels for high-yield exam insights:
  * ⚡ **30-Second Shortcut:** > ⚡ **30-Second Shortcut:** [Fast option elimination, mental calculation, or 30s trick]
  * ⚠️ **Trap Alert:** > ⚠️ **Trap Alert:** [The common trap option, silly mistake pattern, or common misreading]
  * 💡 **Core Rule / Concept:** > 💡 **Core Concept:** [The fundamental grammar rule, geometry theorem, or formula]
  * 📐 **Key Formula:** > 📐 **Key Formula:** [The exact formula or equation to memorize]
- STEP-BY-STEP BREAKDOWN:
  When solving or explaining, use numbered step headers:
  **Step 1:** [Identify given values / grammatical tense]
  **Step 2:** [Apply formula / rule]
  **Step 3:** [Calculation or elimination]
- HIGH-DENSITY & CONCISE:
  Keep answers analytical, crisp, and high-yield. Do not include excessive conversational filler so the candidate gets instant clarity.
- PHOTO & DOCUMENT ATTACHMENTS (Images & PDFs):
  When the candidate uploads an image (photo of a question, math problem, geometry diagram, handwriting/scratchpad, or screenshot) or a PDF document:
  * Thoroughly inspect and extract the exact question, equation, or text from the image/PDF.
  * State the extracted question clearly if needed, and solve it step-by-step.
  * Highlight the fastest shortcut trick, relevant formula, and options elimination technique.
- Format responses beautifully using Markdown: bold key terms, use bullet points, and tables when presenting comparisons or schedules.`;

export default async function handler(req: any, res: any) {
  // CORS headers for local and cloud access
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  let rawApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  // Strip surrounding quotes and whitespace if copied from .env file into Vercel UI
  const apiKey = rawApiKey.replace(/^["']|["']$/g, '').trim();

  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'MY_GEMINI_API_KEY') {
    return res.status(400).json({
      error: 'GEMINI_API_KEY is not configured or empty. Please set GEMINI_API_KEY in your Vercel Project Settings > Environment Variables, and make sure to Redeploy.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { messages, attachment, mockSummary, activeMockContext, activeReviewQuestions, activeQuestion, focusedScope, activeMockId, activeMockTitle } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid request: "messages" array is required.' });
    }

    // Format conversational contents for Gemini with multimodal attachment support
    const contents = messages.map((m: any, idx: number) => {
      const parts: any[] = [];
      const isLatestUser = (idx === messages.length - 1) && (m.role === 'user' || !m.role);
      const msgAttachment = m.attachment || (isLatestUser ? attachment : null);

      if (msgAttachment && msgAttachment.data && msgAttachment.mimeType) {
        const rawBase64 = msgAttachment.data.includes(',')
          ? msgAttachment.data.split(',')[1]
          : msgAttachment.data;
        parts.push({
          inlineData: {
            mimeType: msgAttachment.mimeType,
            data: rawBase64
          }
        });
      }

      parts.push({ text: String(m.text || m.content || '') });

      return {
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts
      };
    });

    const latestUserMsg = messages[messages.length - 1]?.text || '';
    const { intent, matchedTopic, targetQNum, targetMock } = detectUserIntent(
      latestUserMsg,
      activeMockId,
      activeMockTitle
    );

    // ── Build Scoped Focus Context (if user opened Tommy via an AI Chip) ──
    let scopeContext = '';
    if (focusedScope && typeof focusedScope === 'object') {
      const { type, title, subject, stats, questions, summaryText, sourceScope, sourceScopeLabel } = focusedScope;
      const originStr = sourceScopeLabel || (
        sourceScope === 'full_mock'
          ? 'Full Mock Test'
          : sourceScope === 'sectional'
          ? 'Sectional Test'
          : sourceScope === 'subject_wise'
          ? 'Subject-Wise Error Bank'
          : sourceScope === 'mixed'
          ? 'Full Mock & Subject-Wise Errors'
          : ''
      );

      scopeContext += `\n=========================================\n`;
      scopeContext += `🎯 ACTIVE FOCUSED SCOPE: ${String(type || '').toUpperCase()} - "${title}"${originStr ? ` [Origin: ${originStr}]` : ''}\n`;
      if (originStr) scopeContext += `Origin Category: ${originStr}\n`;
      if (subject) scopeContext += `Subject: ${subject}\n`;
      if (stats) {
        if (stats.score !== undefined) scopeContext += `Score: ${stats.score}/${stats.maxMarks || 200} | Accuracy: ${stats.accuracy}%\n`;
        if (stats.wrong !== undefined || stats.slow !== undefined || stats.unattempted !== undefined) {
          scopeContext += `Mistake Breakdown: ${stats.wrong ?? 0} Wrong, ${stats.slow ?? 0} Correct but Slow, ${stats.unattempted ?? 0} Unattempted\n`;
        }
      }
      if (summaryText) {
        scopeContext += `Summary:\n${summaryText}\n`;
      }
      if (Array.isArray(questions) && questions.length > 0) {
        scopeContext += `\n--- MISTAKE QUESTIONS IN THIS ${String(type || '').toUpperCase()} (${questions.length} Items) ---\n`;
        scopeContext += questions.map((q: any, i: number) => {
          const num = q.qNum || (i + 1);
          const optStr = q.options ? Object.entries(q.options).map(([k, v]) => `${k.toUpperCase()}) ${v}`).join(' | ') : '';
          const userAns = q.userAnswer ? q.userAnswer.toUpperCase() : (q.status === 'unattempted' ? 'Skipped' : 'N/A');
          const correctAns = q.answer ? q.answer.toUpperCase() : (q.correctAnswer ? q.correctAnswer.toUpperCase() : 'Refer to solution');
          const rTag = q.rcaTag || q.rca?.tag;
          const rTagName = q.rcaTagName || q.rca?.tagName;
          const rcaTagStr = rTag ? ` [RCA: [${rTag === 'A' ? 'S' : rTag}] ${rTagName || ''}]` : '';
          const sillyStr = q.sillyMistakeNote ? ` [Silly Note: "${q.sillyMistakeNote}"]` : '';
          const status = q.status ? ` [Status: ${q.status.toUpperCase()}]` : '';
          const sourceTag = q.sourceLabel ? ` [Source: ${q.sourceLabel}]` : (q.sourceType ? ` [Source: ${q.sourceType === 'full_mock' ? 'Full Mock Test' : q.sourceType === 'sectional' ? 'Sectional Test' : 'Subject-Wise Error Bank'}]` : '');
          return `[Question #${num}]${sourceTag}${status}${rcaTagStr}${sillyStr}\nQuestion: ${q.question}\nOptions: ${optStr}\nCandidate Choice: ${userAns} | Correct: ${correctAns}\nSolution: ${q.solution || 'See concept'}`;
        }).join('\n-----------------------------------------\n');
      }
      scopeContext += `\n=========================================\n`;
      scopeContext += `FOCUSED SCOPE RULES:
- The candidate explicitly opened you to discuss this ${type}: "${title}".
- SOURCE SPECIFICATION MANDATE: Notice whether these questions are from a Full Mock Test, a Sectional Test, or the Subject-Wise Error Bank. In your opening remark and advice, clearly mention this source context (e.g. "Looking at this Question from your Full Mock Test...", "In this Sectional Test...", or "In your Subject-Wise Error practice...").
- ROOT CAUSE ANALYSIS (RCA) DIRECTIVE: If the scope or questions indicate RCA Mode ([C] Concept Gap, [S] Silly Mistake, [T] Time Issue, [G] Guess), tailor your diagnostic accordingly. For Silly Mistakes, analyze candidate notes and execution traps; for Concept Gaps, teach first-principles theory; for Time Issues, supply rapid shortcuts; for Guesses, teach topper elimination heuristics.
- If they ask about questions, errors, shortcuts, or concepts from this ${type}, refer directly to the exact questions and details provided above.
- If they ask general questions or change the topic, answer helpfully and clearly without hallucinating or forcing the test questions into the response.\n`;
    }

    // ── Selective Context Assembly (Token Optimization) ──
    let selectiveContext = '';

    if (intent === 'GREETING') {
      // 0 extra tokens attached for greetings and casual chitchat
      selectiveContext = '';
    } else {
      // Find question context if user is asking about a specific question
      let targetQ = activeQuestion;
      if (!targetQ && targetQNum && Array.isArray(activeReviewQuestions)) {
        targetQ = activeReviewQuestions.find(
          (q: any) => q.qNum === targetQNum || q.questionNumber === targetQNum
        );
      }

      selectiveContext = buildSelectiveContext({
        userText: latestUserMsg,
        activeQuestion: targetQ,
        activeMockContext,
        activeMockId,
        activeMockTitle
      });

      // If user asks about the active quiz review and not a single question:
      if (!selectiveContext && Array.isArray(activeReviewQuestions) && activeReviewQuestions.length > 0) {
        const isQuizQuery = /quiz|review|test|wrong|mistake|question/i.test(latestUserMsg);
        if (isQuizQuery) {
          // Include only wrong questions (max 5) to stay token-efficient
          const wrongQs = activeReviewQuestions.filter((q: any) => !q.isCorrect).slice(0, 5);
          if (wrongQs.length > 0) {
            selectiveContext = `\n--- ACTIVE QUIZ/MOCK WRONG QUESTIONS (${wrongQs.length} items) ---\n` +
              wrongQs.map((q: any) => `
[Question #${q.qNum}] Topic: ${q.topic || 'General'}
Question: ${q.question}
Options: ${JSON.stringify(q.options || {})}
Candidate Choice: ${q.userAnswer ? q.userAnswer.toUpperCase() : 'Unattempted'} | Correct: ${q.correctAnswer ? q.correctAnswer.toUpperCase() : 'Refer to solution'}
Solution: ${q.solution || 'No solution provided'}
`).join('\n---\n');
          }
        }
      }

      // Only attach mockSummary if user specifically asked about their overall score / test performance
      if (mockSummary && (intent === 'OVERALL_WEAKNESS' || intent === 'FULL_MOCK')) {
        selectiveContext += `\n--- CANDIDATE'S CURRENT MOCK PERFORMANCE SUMMARY ---\n${mockSummary}\n`;
      }
    }

    const fullSystemInstruction = `${SYSTEM_INSTRUCTION}
${scopeContext ? `\n${scopeContext}\n` : ''}
${selectiveContext ? `\n${selectiveContext}\n` : ''}
`;

    const isStream = Boolean(req.body?.stream);
    let configuredModel = (process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || '').trim().replace(/^["']|["']$/g, '');
    const modelName = configuredModel || 'gemini-3.5-flash-lite';

    // ── 1. Streaming Mode (Server-Sent Events) ──
    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      // Try @google/genai SDK streaming first
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const streamResult = await ai.models.generateContentStream({
          model: modelName,
          contents,
          config: {
            systemInstruction: fullSystemInstruction,
            temperature: 0.4,
            maxOutputTokens: 2048
          }
        });

        for await (const chunk of streamResult) {
          const text = chunk.text || '';
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }
        res.write('data: [DONE]\n\n');
        return res.end();
      } catch (sdkStreamErr: any) {
        // Fallback to REST API streaming
        try {
          const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
          const restRes = await fetch(streamUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              systemInstruction: { parts: [{ text: fullSystemInstruction }] },
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 2048
              }
            })
          });

          if (!restRes.ok) {
            const errJson = await restRes.json().catch(() => ({}));
            throw new Error(errJson?.error?.message || `Google API status ${restRes.status}`);
          }

          if (restRes.body) {
            const reader = (restRes.body as any).getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const sseLines = buffer.split('\n');
              buffer = sseLines.pop() || '';
              for (const sseLine of sseLines) {
                if (sseLine.startsWith('data: ')) {
                  const dataStr = sseLine.slice(6).trim();
                  if (!dataStr || dataStr === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(dataStr);
                    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                      res.write(`data: ${JSON.stringify({ text })}\n\n`);
                    }
                  } catch {}
                }
              }
            }
          }
          res.write('data: [DONE]\n\n');
          return res.end();
        } catch (restStreamErr: any) {
          console.error('[Gemini Stream Error]:', sdkStreamErr?.message || restStreamErr?.message);
          res.write(`data: ${JSON.stringify({ error: sdkStreamErr?.message || restStreamErr?.message || 'Failed to stream response.' })}\n\n`);
          res.write('data: [DONE]\n\n');
          return res.end();
        }
      }
    }

    // ── 2. Standard Non-Streaming Fallback ──
    let reply = '';

    // First attempt: Direct REST API
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: fullSystemInstruction }]
          },
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048
          }
        })
      });

      if (!geminiRes.ok) {
        const errJson = await geminiRes.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Google API status ${geminiRes.status}`);
      }

      const geminiData = await geminiRes.json();
      reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (restErr: any) {
      // Secondary fallback: @google/genai SDK
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: fullSystemInstruction,
            temperature: 0.4,
            maxOutputTokens: 2048
          }
        });
        reply = response.text || '';
      } catch (sdkErr: any) {
        throw new Error(restErr?.message || sdkErr?.message || 'Failed to process chat with Gemini.');
      }
    }

    if (!reply) {
      reply = 'I apologize, but I could not generate a response at this moment.';
    }

    return res.status(200).json({ reply });
  } catch (error: any) {
    console.error('[Gemini Chat Error]:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process chat with Gemini.'
    });
  }
}

