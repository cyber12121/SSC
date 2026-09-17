import { SubjectData, Chapter, Question, RCAClassification, RCATagType } from '../types';
import { MockChapterModalData } from '../components/modals/MockChapterErrorsModal';
import { detectTopic, normalizeTopicTitle } from './topicDetector';
import { classifyTestType, TestScopeFilter } from './testClassifier';
import { safeStorage } from './safeStorage';
import { getDeletedMockIds } from './syncMockReports';
import { findQuestionRca, getGlobalRcaStore } from './rcaHelper';

const mockQuestionModules = import.meta.glob('../data/mock_questions/*.json');

export interface AggregatedMockData {
  clubbedChapters: Record<string, MockChapterModalData[]>;
  mockScopeCounts: Record<string, { all: number; full: number; sectional: number }>;
  overallScopeCounts: { all: number; full: number; sectional: number };
  subjectRcaData: Record<string, {
    totals: Record<RCATagType | 'unclassified', number>;
    questionsByTag: Record<RCATagType | 'unclassified', Question[]>;
  }>;
  overallRcaTotals: Record<RCATagType | 'unclassified', number>;
  totalOverallErrors: number;
  heatmapSubjectGroups: Record<string, {
    subject: string;
    totalErrors: number;
    totalWrong: number;
    totalUnattempted: number;
    totalSpeed: number;
    negativeMarks: number;
    rcaTotals: Record<RCATagType | 'unclassified', number>;
    chapters: any[];
  }>;
}

export interface AggregateOptions {
  mockData?: SubjectData;
  bundledQuestions?: any[];
  testScopeFilter?: TestScopeFilter;
  gkFilter?: string;
  selectedSubject?: string | null;
}

// In-memory cache for bundled mock questions
let cachedBundledQuestions: any[] | null = null;
let bundledPromise: Promise<any[]> | null = null;

export async function loadAllBundledMockQuestions(): Promise<any[]> {
  if (cachedBundledQuestions) return cachedBundledQuestions;
  if (bundledPromise) return bundledPromise;

  bundledPromise = (async () => {
    const all: any[] = [];
    const deletedIds = getDeletedMockIds();
    for (const [path, loader] of Object.entries(mockQuestionModules)) {
      try {
        const mod: any = await (loader as () => Promise<any>)();
        const raw = mod?.default || mod;
        const list = Array.isArray(raw) ? raw : (raw?.questions || raw?.data || []);
        if (Array.isArray(list) && list.length > 0) {
          const fileId = path.split('/').pop()?.replace('.json', '');
          const nonDeleted = list
            .filter((q: any) => {
              const mId = q.mockId || q.testId || fileId;
              return !mId || !deletedIds.has(mId);
            })
            .map((q: any) => ({
              ...q,
              mockId: q.mockId || q.testId || fileId,
              isFromBundledMock: true
            }));
          all.push(...nonDeleted);
        }
      } catch (err) {
        console.warn(`[mockErrorAggregator] Failed to load bundled mock ${path}:`, err);
      }
    }
    cachedBundledQuestions = all;
    return all;
  })();

  return bundledPromise;
}

export function getCachedBundledQuestionsSync(): any[] {
  return cachedBundledQuestions || [];
}

export function getAllCachedMockQuestions(): any[] {
  const cachedMockQuestions: any[] = [];
  try {
    const deletedMockIds = getDeletedMockIds();
    const allKeys = safeStorage.getAllKeys();
    for (const key of allKeys) {
      if (key && key.startsWith('cgl_mock_questions_')) {
        const mId = key.replace('cgl_mock_questions_', '');
        if (deletedMockIds.has(mId)) continue;
        const raw = safeStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const valid = parsed
                .filter((q: any) => {
                  const qMId = q.mockId || q.testId || mId;
                  return !deletedMockIds.has(qMId);
                })
                .map((q: any) => ({
                  ...q,
                  mockId: q.mockId || q.testId || mId,
                  isFromUserMock: true
                }));
              cachedMockQuestions.push(...valid);
            }
          } catch {}
        }
      }
    }
  } catch {}
  return cachedMockQuestions;
}

export function normalizeSubjectName(sub?: string): string {
  const s = (sub || '').toLowerCase();
  if (s.includes('math') || s.includes('quant')) return 'Mathematics';
  if (s.includes('reason') || s.includes('logic') || s.includes('intel')) return 'Reasoning';
  if (s.includes('eng')) return 'English';
  return 'General Awareness';
}

/**
 * Core unified aggregation engine:
 * 1. Combines static mock errors, bundled full tests, cached tests, and global RCA store
 * 2. Normalizes & deduplicates by subject + question text
 * 3. Classifies origin: 'full_mock' | 'sectional' | 'subject_wise' with human-friendly labels
 * 4. Yields consistent question counts, RCA breakdowns, and test scopes
 */
export function aggregateMockErrors(options: AggregateOptions): AggregatedMockData {
  const {
    mockData = {},
    bundledQuestions = getCachedBundledQuestionsSync(),
    testScopeFilter = 'all',
    gkFilter = 'all',
    selectedSubject = null
  } = options;

  const canonicalSubjects = ['Mathematics', 'Reasoning', 'English', 'General Awareness'];
  const globalRcaStore = getGlobalRcaStore();
  const cachedUserQuestions = getAllCachedMockQuestions();
  const deletedMockIds = getDeletedMockIds();

  // Initialize data structures
  const mockScopeCounts: Record<string, { all: number; full: number; sectional: number }> = {};
  const subjectRcaData: Record<string, {
    totals: Record<RCATagType | 'unclassified', number>;
    questionsByTag: Record<RCATagType | 'unclassified', Question[]>;
  }> = {};
  const heatmapSubjectGroups: AggregatedMockData['heatmapSubjectGroups'] = {};
  const clubbedChapterMaps: Record<string, Record<string, MockChapterModalData>> = {};

  const overallScopeCounts = { all: 0, full: 0, sectional: 0 };
  const overallRcaTotals: Record<RCATagType | 'unclassified', number> = {
    C: 0, A: 0, T: 0, G: 0, unclassified: 0
  };

  canonicalSubjects.forEach(sub => {
    mockScopeCounts[sub] = { all: 0, full: 0, sectional: 0 };
    subjectRcaData[sub] = {
      totals: { C: 0, A: 0, T: 0, G: 0, unclassified: 0 },
      questionsByTag: { C: [], A: [], T: [], G: [], unclassified: [] }
    };
    heatmapSubjectGroups[sub] = {
      subject: sub,
      totalErrors: 0,
      totalWrong: 0,
      totalUnattempted: 0,
      totalSpeed: 0,
      negativeMarks: 0,
      rcaTotals: { C: 0, A: 0, T: 0, G: 0, unclassified: 0 },
      chapters: []
    };
    clubbedChapterMaps[sub] = {};
  });

  // Tracking sets for deduplication
  const seenErrorsAll = new Set<string>();
  const processedQuestions = new Map<string, any>();

  const processQuestion = (
    q: any,
    defaultSubject: string,
    originHint: 'subject_wise' | 'full_mock' | 'sectional' = 'subject_wise'
  ) => {
    const mId = q.mockId || q.testId;
    if (mId && deletedMockIds.has(mId)) return;

    const subject = normalizeSubjectName(q.subject || q.section || defaultSubject);
    const qText = (q.question || q.questionText || '').trim();
    if (!qText && !q.id) return;

    const dedupKey = (qText ? `${subject}|${qText.toLowerCase()}` : String(q.id || '')).slice(0, 160);

    // Determine error type
    let errorType: 'wrong' | 'unattempted' | 'speed_issue' | null = null;
    const status = String(q.status || q.errorType || '').toLowerCase();
    if (status.includes('unattempt') || status.includes('skip') || status.includes('left')) {
      errorType = 'unattempted';
    } else if (status.includes('speed') || status.includes('slow') || q.isSlow) {
      errorType = 'speed_issue';
    } else if (status.includes('wrong') || status.includes('incorrect') || q.isCorrect === false || (q.userAnswer && q.answer && String(q.userAnswer).toLowerCase() !== String(q.answer).toLowerCase())) {
      errorType = 'wrong';
    }

    const qRca = findQuestionRca(q, globalRcaStore);
    if (!errorType && qRca) {
      errorType = 'wrong';
    }

    // Filter out clean correct questions without speed issues or RCA tags
    if (!errorType && (q.isCorrect === true || status === 'correct')) {
      return;
    }
    if (!errorType) {
      errorType = 'wrong';
    }

    // Scope classification: full vs sectional
    const classifiedScope: 'full' | 'sectional' = classifyTestType(q);
    const rawTestName = q.testName || q.test_name || q.testTitle || q.mockTitle || '';

    // Determine fine-grained sourceType and human-friendly sourceLabel
    let sourceType: 'full_mock' | 'sectional' | 'subject_wise' = originHint;
    if (originHint === 'subject_wise' && (q.mockId || rawTestName || q.isFromBundledMock || q.isFromUserMock)) {
      sourceType = classifiedScope === 'sectional' ? 'sectional' : 'full_mock';
    } else if (originHint !== 'subject_wise') {
      sourceType = classifiedScope === 'sectional' ? 'sectional' : 'full_mock';
    }

    let sourceLabel = '';
    if (sourceType === 'full_mock') {
      sourceLabel = rawTestName ? `Full Mock: ${rawTestName}` : 'Full Mock Test';
    } else if (sourceType === 'sectional') {
      sourceLabel = rawTestName ? `Sectional Test: ${rawTestName}` : 'Sectional Test';
    } else {
      sourceLabel = `Subject-Wise Error Bank (${subject})`;
    }

    // Track scope counts for each unique question (once across all sources)
    if (!seenErrorsAll.has(dedupKey)) {
      seenErrorsAll.add(dedupKey);
      overallScopeCounts.all++;
      mockScopeCounts[subject].all++;
      if (classifiedScope === 'full') {
        overallScopeCounts.full++;
        mockScopeCounts[subject].full++;
      } else {
        overallScopeCounts.sectional++;
        mockScopeCounts[subject].sectional++;
      }
    }

    // Check if duplicate in active list
    if (processedQuestions.has(dedupKey)) {
      const existing = processedQuestions.get(dedupKey);
      // Merge RCA tag if existing didn't have one and this one does
      if (qRca && (!existing.rca || !existing.rca.tag)) {
        existing.rca = qRca;
        existing.rcaClassification = qRca;
      }
      if (!existing.testName && rawTestName) {
        existing.testName = rawTestName;
        existing.sourceType = sourceType;
        existing.sourceLabel = sourceLabel;
      }
      return;
    }

    // Apply active test scope filter ('all' vs 'full' vs 'sectional')
    if (testScopeFilter !== 'all' && classifiedScope !== testScopeFilter) {
      return;
    }

    const rawT = q.tags?.topic || q.topic || q.detectedTopic;
    const normT = rawT ? normalizeTopicTitle(rawT) : '';
    const topic = (normT && normT !== 'General') ? normT : detectTopic(q, subject);

    const enrichedQuestion: Question & {
      errorType: 'speed_issue' | 'unattempted' | 'wrong';
      rca?: RCAClassification;
      rcaClassification?: RCAClassification;
      sourceType?: 'full_mock' | 'sectional' | 'subject_wise';
      sourceLabel?: string;
      testName?: string;
      detectedTopic?: string;
      parentSubject?: string;
    } = {
      ...q,
      question: qText,
      subject,
      errorType,
      rca: qRca,
      rcaClassification: qRca,
      sourceType,
      sourceLabel,
      testName: rawTestName || undefined,
      detectedTopic: topic,
      parentSubject: subject
    };

    processedQuestions.set(dedupKey, enrichedQuestion);

    // ── Update Clubbed Chapters for App.tsx Mock Errors View ──
    if (!clubbedChapterMaps[subject][topic]) {
      clubbedChapterMaps[subject][topic] = {
        topic,
        subject,
        total: 0,
        slow: 0,
        unattempted: 0,
        wrong: 0,
        questions: [],
        slowQuestions: [],
        unattemptedQuestions: [],
        wrongQuestions: [],
        rcaCounts: { C: 0, A: 0, T: 0, G: 0, unclassified: 0 },
        rcaQuestions: { C: [], A: [], T: [], G: [], unclassified: [] }
      };
    }

    const chItem = clubbedChapterMaps[subject][topic];
    chItem.total++;
    chItem.questions.push(enrichedQuestion);

    if (errorType === 'speed_issue') {
      chItem.slow++;
      chItem.slowQuestions.push(enrichedQuestion);
    } else if (errorType === 'unattempted') {
      chItem.unattempted++;
      chItem.unattemptedQuestions.push(enrichedQuestion);
    } else {
      chItem.wrong++;
      chItem.wrongQuestions.push(enrichedQuestion);
    }

    const tagKey: RCATagType | 'unclassified' = (qRca && qRca.tag && ['C', 'A', 'T', 'G'].includes(qRca.tag))
      ? (qRca.tag as RCATagType)
      : 'unclassified';

    chItem.rcaCounts![tagKey]++;
    chItem.rcaQuestions![tagKey].push(enrichedQuestion);

    // ── Update Subject-Level RCA Data ──
    subjectRcaData[subject].totals[tagKey]++;
    subjectRcaData[subject].questionsByTag[tagKey].push(enrichedQuestion);
    overallRcaTotals[tagKey]++;

    // ── Update Heatmap Group Data ──
    heatmapSubjectGroups[subject].totalErrors++;
    if (errorType === 'wrong') {
      heatmapSubjectGroups[subject].totalWrong++;
      heatmapSubjectGroups[subject].negativeMarks += 0.5;
    } else if (errorType === 'unattempted') {
      heatmapSubjectGroups[subject].totalUnattempted++;
    } else {
      heatmapSubjectGroups[subject].totalSpeed++;
    }
    heatmapSubjectGroups[subject].rcaTotals[tagKey]++;
  };

  // 1. Ingest static mock errors (mock_errors/*.json)
  canonicalSubjects.forEach(sub => {
    const chapters = mockData[sub] || [];
    chapters.forEach((ch: Chapter) => {
      (ch.questions || []).forEach((q: any) => {
        processQuestion(q, sub, 'subject_wise');
      });
    });
  });

  // 2. Ingest bundled mock questions (mock_questions/*.json)
  bundledQuestions.forEach((q: any) => {
    const sub = normalizeSubjectName(q.subject || q.section);
    processQuestion(q, sub, 'full_mock');
  });

  // 3. Ingest cached mock questions from student test attempts
  cachedUserQuestions.forEach((q: any) => {
    const sub = normalizeSubjectName(q.subject || q.section);
    processQuestion(q, sub, 'full_mock');
  });

  // Sort and assemble clubbedChapters per subject
  const clubbedChapters: Record<string, MockChapterModalData[]> = {};
  canonicalSubjects.forEach(sub => {
    clubbedChapters[sub] = Object.values(clubbedChapterMaps[sub]).sort((a, b) => b.total - a.total);

    const subjectTotalErrors = Object.values(clubbedChapterMaps[sub]).reduce((s, c) => s + c.total, 0);
    heatmapSubjectGroups[sub].chapters = clubbedChapters[sub].map(ch => {
      const errorShare = subjectTotalErrors > 0 ? (ch.total / subjectTotalErrors) * 100 : 0;
      let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
      if (errorShare >= 15 || ch.wrong >= 5) severity = 'critical';
      else if (errorShare >= 8 || ch.wrong >= 3) severity = 'high';
      else if (errorShare >= 4 || ch.total >= 2) severity = 'medium';
      const marksRecovery = Math.round((Math.ceil(ch.wrong * 0.6) * 2 + ch.wrong * 0.5) * 10) / 10;
      return {
        topic: ch.topic,
        subject: ch.subject,
        totalErrors: ch.total,
        wrongCount: ch.wrong,
        unattemptedCount: ch.unattempted,
        speedIssueCount: ch.slow,
        negativeMarks: ch.wrong * 0.5,
        questions: ch.questions,
        rcaCounts: ch.rcaCounts || { C: 0, A: 0, T: 0, G: 0, unclassified: 0 },
        severity,
        marksRecovery
      };
    });
  });

  const totalOverallErrors = processedQuestions.size;

  return {
    clubbedChapters,
    mockScopeCounts,
    overallScopeCounts,
    subjectRcaData,
    overallRcaTotals,
    totalOverallErrors,
    heatmapSubjectGroups
  };
}
