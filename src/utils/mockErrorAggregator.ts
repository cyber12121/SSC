import { SubjectData, Chapter, Question, RCAClassification, RCATagType } from '../types';
import { MockChapterModalData } from '../components/modals/MockChapterErrorsModal';
import { detectTopic, normalizeTopicTitle } from './topicDetector';
import { normalizeSubtopic } from './subtopicNormalizer';
import { classifyTestType, TestScopeFilter } from './testClassifier';
import { safeStorage } from './safeStorage';
import { getDeletedMockIds } from './syncMockReports';
import { findQuestionRca, getGlobalRcaStore } from './rcaHelper';
import { getTopicGKSubject, GKSubjectId, GK_SUBJECT_CONFIGS } from './gkSubjectHelper';

const mockQuestionModules = import.meta.glob('../data/mock_questions/*.json');

export interface AggregatedMockData {
  clubbedChapters: Record<string, MockChapterModalData[]>;
  mockScopeCounts: Record<string, { all: number; full: number; sectional: number }>;
  overallScopeCounts: { all: number; full: number; sectional: number };
  gkCounts: Record<string, number>;
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
  deletedQuestionIds?: Set<string>;
}

// In-memory cache for bundled mock questions
let cachedBundledQuestions: any[] | null = null;
let bundledPromise: Promise<any[]> | null = null;

export function getDeletedQuestionIds(): Set<string> {
  try {
    const raw = safeStorage.getItem('cgl_deleted_question_ids');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map((s: string) => String(s).trim().toLowerCase()));
      }
    }
  } catch {}
  return new Set();
}

export function evictDeletedQuestionFromAggregator(questionId?: string, questionText?: string): void {
  const qIdLower = questionId ? String(questionId).toLowerCase().trim() : '';
  const qTextLower = questionText ? questionText.trim().toLowerCase() : '';
  const coreLower = qTextLower ? qTextLower.replace(/\\[a-zA-Z]+/g, ' ').replace(/[^a-zA-Z0-9]/g, '') : '';

  if (cachedBundledQuestions && Array.isArray(cachedBundledQuestions)) {
    cachedBundledQuestions = cachedBundledQuestions.filter((q: any) => {
      const thisId = q.id ? String(q.id).toLowerCase().trim() : '';
      const thisText = (q.question || q.questionText || '').trim().toLowerCase();
      const thisCore = thisText ? thisText.replace(/\\[a-zA-Z]+/g, ' ').replace(/[^a-zA-Z0-9]/g, '') : '';

      if (qIdLower && thisId === qIdLower) return false;
      if (qTextLower && thisText === qTextLower) return false;
      if (coreLower && thisCore && coreLower === thisCore) return false;
      return true;
    });
  }
}

export async function loadAllBundledMockQuestions(): Promise<any[]> {
  if (cachedBundledQuestions) return cachedBundledQuestions;
  if (bundledPromise) return bundledPromise;

  bundledPromise = (async () => {
    const deletedIds = getDeletedMockIds();
    const deletedQIds = getDeletedQuestionIds();

    const isQDeleted = (q: any) => {
      const qId = q.id ? String(q.id).toLowerCase().trim() : '';
      const qText = (q.question || q.questionText || '').trim().toLowerCase();
      const core = qText ? qText.replace(/\\[a-zA-Z]+/g, ' ').replace(/[^a-zA-Z0-9]/g, '') : '';
      return (
        (qId && deletedQIds.has(qId)) ||
        (qText && deletedQIds.has(qText)) ||
        (core && deletedQIds.has(core))
      );
    };

    // 1. Fast path: single network request from backend cache (~20ms)
    try {
      const res = await fetch('/api/bundled-mock-questions');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          const filtered = list.filter((q: any) => {
            const mId = q.mockId || q.testId;
            if (mId && deletedIds.has(mId)) return false;
            return !isQDeleted(q);
          });
          cachedBundledQuestions = filtered;
          return filtered;
        }
      }
    } catch (e) {
      // Fall through to dynamic module loader
    }

    // 2. Fallback path: dynamic client-side imports
    const all: any[] = [];
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
              if (mId && deletedIds.has(mId)) return false;
              return !isQDeleted(q);
            })
            .map((q: any) => ({
              ...q,
              mockId: q.mockId || q.testId || fileId,
              testId: q.testId || q.mockId || fileId,
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
    const deletedQIds = getDeletedQuestionIds();
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
                  if (deletedMockIds.has(qMId)) return false;
                  const qId = q.id ? String(q.id).toLowerCase().trim() : '';
                  const qText = (q.question || q.questionText || '').trim().toLowerCase();
                  const core = qText ? qText.replace(/\\[a-zA-Z]+/g, ' ').replace(/[^a-zA-Z0-9]/g, '') : '';
                  if (qId && deletedQIds.has(qId)) return false;
                  if (qText && deletedQIds.has(qText)) return false;
                  if (core && deletedQIds.has(core)) return false;
                  return true;
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
    selectedSubject = null,
    deletedQuestionIds
  } = options;

  const deletedQuestionSet = deletedQuestionIds || getDeletedQuestionIds();
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
    C: 0, S: 0, T: 0, G: 0, unclassified: 0
  };

  canonicalSubjects.forEach(sub => {
    mockScopeCounts[sub] = { all: 0, full: 0, sectional: 0 };
    subjectRcaData[sub] = {
      totals: { C: 0, S: 0, T: 0, G: 0, unclassified: 0 },
      questionsByTag: { C: [], S: [], T: [], G: [], unclassified: [] }
    };
    heatmapSubjectGroups[sub] = {
      subject: sub,
      totalErrors: 0,
      totalWrong: 0,
      totalUnattempted: 0,
      totalSpeed: 0,
      negativeMarks: 0,
      rcaTotals: { C: 0, S: 0, T: 0, G: 0, unclassified: 0 },
      chapters: []
    };
    clubbedChapterMaps[sub] = {};
  });

  // Tracking sets for deduplication
  const seenErrorsAll = new Set<string>();
  const processedQuestions = new Map<string, any>();

  // GK question counts under current testScopeFilter
  const gkCounts: Record<string, number> = {
    all: 0,
    history: 0,
    polity: 0,
    geography: 0,
    economics: 0,
    science: 0,
    static_gk: 0
  };
  const seenGkQuestions = new Set<string>();

  const processQuestion = (
    q: any,
    defaultSubject: string,
    originHint: 'subject_wise' | 'full_mock' | 'sectional' = 'subject_wise'
  ) => {
    const mId = q.mockId || q.testId;
    if (mId && deletedMockIds.has(mId)) return;

    const qText = (q.question || q.questionText || '').trim();
    if (!qText && !q.id) return;

    const qTextLower = qText.toLowerCase();
    const qIdLower = q.id ? String(q.id).toLowerCase().trim() : '';
    const coreText = qText
      ? qText.replace(/\\[a-zA-Z]+/g, ' ').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      : '';

    // Permanently filter out deleted questions
    if (
      (qIdLower && deletedQuestionSet.has(qIdLower)) ||
      (qTextLower && deletedQuestionSet.has(qTextLower)) ||
      (coreText && deletedQuestionSet.has(coreText))
    ) {
      return;
    }

    const subject = normalizeSubjectName(q.subject || q.section || defaultSubject);

    const dedupKey = (coreText.length >= 12
      ? `${subject}|${coreText.slice(0, 100)}`
      : (qText ? `${subject}|${qText.toLowerCase()}` : String(q.id || ''))).slice(0, 160);

    // Determine error type accurately
    let errorType: 'wrong' | 'unattempted' | 'speed_issue' | null = null;
    const status = String(q.status || q.errorType || '').toLowerCase();
    const rawUserAnswer = String(q.userAnswer || q.selectedAnswer || q.chosenOption || '').trim();
    const hasUserAnswer = rawUserAnswer !== '' && !['unattempted', 'skipped', 'left', 'not attempted'].includes(rawUserAnswer.toLowerCase());

    const rawTarget = String(q.answer || q.correctOption || q.correctAnswer || '').trim().toLowerCase();
    const isExplicitWrongAnswer = Boolean(
      hasUserAnswer &&
      rawTarget &&
      rawUserAnswer.toLowerCase() !== rawTarget
    );

    const isWrong =
      isExplicitWrongAnswer ||
      status.includes('wrong') ||
      status.includes('incorrect') ||
      (hasUserAnswer && q.isCorrect === false) ||
      q.isCorrect === false ||
      q.is_correct === false;

    const isConfirmedCorrect =
      (!isWrong && (
        (status.includes('correct') && !status.includes('incorrect')) ||
        status === 'right' ||
        q.isCorrect === true ||
        q.is_correct === true ||
        (hasUserAnswer && rawTarget && rawUserAnswer.toLowerCase() === rawTarget)
      ));

    if (
      status.includes('unattempt') ||
      status.includes('skip') ||
      status.includes('left') ||
      status === 'not attempted' ||
      (!hasUserAnswer && !isConfirmedCorrect && !isWrong)
    ) {
      errorType = 'unattempted';
    } else if (isWrong) {
      errorType = 'wrong';
    } else if ((status.includes('speed') || status.includes('slow') || q.isSlow) && isConfirmedCorrect) {
      errorType = 'speed_issue';
    } else if (isConfirmedCorrect) {
      // Clean correct without speed issues - filter out
      return;
    } else {
      errorType = hasUserAnswer ? 'wrong' : 'unattempted';
    }

    const qRca = findQuestionRca(q, globalRcaStore);
    if (!errorType && qRca) {
      errorType = hasUserAnswer ? 'wrong' : 'unattempted';
    }

    // Filter out clean correct questions without speed issues or RCA tags
    if (!errorType && (q.isCorrect === true || status === 'correct' || status === 'right')) {
      return;
    }
    if (!errorType) {
      errorType = hasUserAnswer ? 'wrong' : 'unattempted';
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

    // Resolve topic early (fall back to subtopic if topic is generic e.g. English Comprehension)
    let rawT = q.tags?.topic || q.topic || q.detectedTopic;
    if (!rawT || ['General', 'Unknown', 'English Comprehension', 'English', 'General Intelligence', 'General Awareness', 'General Science', 'Quantitative Aptitude'].includes(rawT)) {
      rawT = q.subtopic || q.tags?.subtopic || rawT;
    }
    const normT = rawT ? normalizeTopicTitle(rawT) : '';
    const topic = (normT && normT !== 'General') ? normT : detectTopic(q, subject);

    // Resolve GK sub-discipline and count across unique questions under current testScopeFilter
    let questionGkSubject: GKSubjectId = 'static_gk';
    if (subject === 'General Awareness') {
      const explicitGk = q.gk_subject || q.tags?.gk_subject;
      if (explicitGk && explicitGk in GK_SUBJECT_CONFIGS) {
        questionGkSubject = explicitGk as GKSubjectId;
      } else {
        questionGkSubject = getTopicGKSubject(topic);
      }

      if (!seenGkQuestions.has(dedupKey)) {
        if (testScopeFilter === 'all' || classifiedScope === testScopeFilter) {
          seenGkQuestions.add(dedupKey);
          gkCounts.all = (gkCounts.all || 0) + 1;
          gkCounts[questionGkSubject] = (gkCounts[questionGkSubject] || 0) + 1;
        }
      }
    }

    // GK sub-discipline filter check (History, Geography, Polity, Economics, Science, Static GK)
    const isGkFilterActive = selectedSubject === 'General Awareness' && gkFilter && gkFilter !== 'all';
    if (isGkFilterActive && subject === 'General Awareness' && questionGkSubject !== gkFilter) {
      return;
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
      // If incoming question has richer formatting or an image, upgrade existing question
      if (q.questionText || (qText && qText.includes('$') && !existing.question?.includes('$'))) {
        existing.question = qText;
      }
      if (q.solution && (q.solution.includes('$') || q.solution.length > (existing.solution || '').length)) {
        existing.solution = q.solution;
      }
      if (q.image && !existing.image) {
        existing.image = q.image;
      }
      if (q.options && Object.keys(q.options).length > 0) {
        existing.options = q.options;
      }
      // Merge RCA tag: prioritize user classification if available
      if (qRca) {
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

    const extraContext = [q.conceptTested, q.tags?.conceptTested, q.solution, (q as any).explanation].filter(Boolean).join(' ');
    const canonicalSubtopic = normalizeSubtopic(topic, q.subtopic || q.tags?.subtopic || q.conceptTested, qText, extraContext);

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
      topic,
      subtopic: canonicalSubtopic,
      tags: {
        ...(q.tags || {}),
        topic,
        subtopic: canonicalSubtopic,
        ...(qRca?.sillyMistakeNote ? { sillyMistake: qRca.sillyMistakeNote } : {})
      },
      errorType,
      rca: qRca,
      rcaClassification: qRca,
      sillyMistakeNote: qRca?.sillyMistakeNote || q.sillyMistakeNote || (q.rca as any)?.sillyMistakeNote || undefined,
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
        rcaCounts: { C: 0, S: 0, T: 0, G: 0, unclassified: 0 },
        rcaQuestions: { C: [], S: [], T: [], G: [], unclassified: [] }
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

    const effectiveTag = (qRca?.tag as any) === 'A' ? 'S' : qRca?.tag;
    const tagKey: RCATagType | 'unclassified' = (effectiveTag && ['C', 'S', 'T', 'G'].includes(effectiveTag))
      ? (effectiveTag as RCATagType)
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

  // 1. Ingest bundled mock questions (mock_questions/*.json) FIRST so authoritative formatted questions and solutions take precedence
  bundledQuestions.forEach((q: any) => {
    const sub = normalizeSubjectName(q.subject || q.section);
    processQuestion(q, sub, 'full_mock');
  });

  // 2. Ingest static mock errors (mock_errors/*.json)
  canonicalSubjects.forEach(sub => {
    const chapters = mockData[sub] || [];
    chapters.forEach((ch: Chapter) => {
      (ch.questions || []).forEach((q: any) => {
        processQuestion(q, sub, 'subject_wise');
      });
    });
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
        rcaCounts: ch.rcaCounts || { C: 0, S: 0, T: 0, G: 0, unclassified: 0 },
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
    gkCounts,
    subjectRcaData,
    overallRcaTotals,
    totalOverallErrors,
    heatmapSubjectGroups
  };
}
