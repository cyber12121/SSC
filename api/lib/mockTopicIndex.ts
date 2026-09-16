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
      const testsDir = path.join(cwd, 'src', 'data', 'mock_tests');
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

      // 2. Ingest mock_tests
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
            const candidatePaths = [
              path.join(testsDir, `${rep.id}.json`),
              path.join(cwd, 'src', 'data', 'mock_questions', `${rep.id}.json`)
            ];
            for (const cp of candidatePaths) {
              if (fs.existsSync(cp)) {
                this.mockRegistry.push({
                  id: rep.id,
                  title: rep.title,
                  platform: (rep as any).platform,
                  filePath: cp
                });
                break;
              }
            }
          }
        } catch {}
      }

      // Also ensure all test files in mock_tests are registered
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
    return `\n--- ACTIVE QUESTION REVIEW CONTEXT (Question #${q.qNum || q.questionNumber || targetQNum || '1'}) ---
Topic: ${q.topic || 'General'}${q.subtopic ? ` → ${q.subtopic}` : ''}
${q.conceptTested ? `Concept Tested: ${q.conceptTested}\n` : ''}Question: ${q.question || q.questionText}
Options: ${JSON.stringify(q.options || {})}
Candidate Choice: ${q.userAnswer || q.chosenOption || 'Unattempted'}
Correct Answer: ${q.correctAnswer || q.correctOption || 'Refer to solution'}
Official Solution:
${q.solution || 'No solution provided'}
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

export default function handler(req: any, res: any) {
  return res.status(200).json({ status: 'ok' });
}
