import { MockScoreReport } from '../types/mockScore';
import { normalizeTopicTitle } from './topicDetector';

export interface MockSummaryStats {
  totalMocks: number;
  fullMocksCount: number;
  sectionalMocksCount: number;
  averageScore: number;
  highestScore: number;
  latestScore?: number;
  overallAccuracy: number;
  sectionStats: Record<string, {
    totalAttempted: number;
    totalCorrect: number;
    totalWrong: number;
    accuracy: number;
    avgScore: number;
  }>;
  weakTopics: { topic: string; subject: string; wrongCount: number }[];
  recentMocks: { title: string; score: number; date: string; accuracy: number }[];
}

/**
 * Summarizes the student's mock history into a structured token-efficient briefing for Gemini.
 * Includes: score trend (#1), time-trap topics (#2), marks recovery (#4),
 * cross-mock recurrence (#5), subtopic breakdown (#9).
 */
export function buildMockAiSummary(
  reports: MockScoreReport[],
  mockErrorsData?: Record<string, any[]>,
  activeMockReport?: MockScoreReport | null
): string {
  if (!reports || reports.length === 0) {
    return 'The candidate has not taken or imported any mock tests yet. Advise them to attempt their first full or sectional mock to calibrate their baseline preparation.';
  }

  const fullMocks = reports.filter(r => r.type === 'full');
  const sectionalMocks = reports.filter(r => r.type === 'sectional');

  const fullScores = fullMocks.map(r => r.totalScore || 0);
  const fullAvgScore = fullScores.length > 0
    ? Math.round((fullScores.reduce((a, b) => a + b, 0) / fullScores.length) * 10) / 10
    : 0;
  const fullHighestScore = fullScores.length > 0 ? Math.max(...fullScores) : 0;

  // Sectional breakdown by subject
  const mathSectionals = sectionalMocks.filter(r => (r.subject || r.title || '').toLowerCase().includes('math'));
  const englishSectionals = sectionalMocks.filter(r => (r.subject || r.title || '').toLowerCase().includes('eng'));
  const reasoningSectionals = sectionalMocks.filter(r => (r.subject || r.title || '').toLowerCase().includes('reason'));
  const gaSectionals = sectionalMocks.filter(r => (r.subject || r.title || '').toLowerCase().includes('aware') || (r.title || '').toLowerCase().includes('gk'));

  const getSecAvg = (arr: MockScoreReport[]) => {
    if (arr.length === 0) return 0;
    return Math.round((arr.reduce((sum, m) => sum + (m.totalScore || 0), 0) / arr.length) * 10) / 10;
  };

  // Section aggregates across all mocks
  const sections: Record<string, { correct: number; wrong: number; score: number; count: number }> = {
    Reasoning: { correct: 0, wrong: 0, score: 0, count: 0 },
    Mathematics: { correct: 0, wrong: 0, score: 0, count: 0 },
    English: { correct: 0, wrong: 0, score: 0, count: 0 },
    'General Awareness': { correct: 0, wrong: 0, score: 0, count: 0 }
  };

  reports.forEach(r => {
    if (r.sections) {
      if (r.sections.reasoning) {
        sections.Reasoning.correct += r.sections.reasoning.correct;
        sections.Reasoning.wrong += r.sections.reasoning.wrong;
        sections.Reasoning.score += r.sections.reasoning.score;
        sections.Reasoning.count++;
      }
      if (r.sections.mathematics) {
        sections.Mathematics.correct += r.sections.mathematics.correct;
        sections.Mathematics.wrong += r.sections.mathematics.wrong;
        sections.Mathematics.score += r.sections.mathematics.score;
        sections.Mathematics.count++;
      }
      if (r.sections.english) {
        sections.English.correct += r.sections.english.correct;
        sections.English.wrong += r.sections.english.wrong;
        sections.English.score += r.sections.english.score;
        sections.English.count++;
      }
      if (r.sections.generalAwareness) {
        sections['General Awareness'].correct += r.sections.generalAwareness.correct;
        sections['General Awareness'].wrong += r.sections.generalAwareness.wrong;
        sections['General Awareness'].score += r.sections.generalAwareness.score;
        sections['General Awareness'].count++;
      }
    }
  });

  // Calculate Section Accuracies & Averages
  const sectionLines = Object.entries(sections)
    .filter(([_, data]) => data.count > 0)
    .map(([sub, data]) => {
      const attempted = data.correct + data.wrong;
      const acc = attempted > 0 ? Math.round((data.correct / attempted) * 1000) / 10 : 0;
      const avg = Math.round((data.score / data.count) * 10) / 10;
      return `- ${sub}: Avg Score: ${avg}/50 | Accuracy: ${acc}% (Total Correct: ${data.correct}, Wrong: ${data.wrong}, Tests counted: ${data.count})`;
    });

  // ── #9: Topic-level errors with SUBTOPIC breakdown ─────────────────────────
  interface TopicErrorEntry {
    topic: string;
    subject: string;
    count: number;
    wrong: number;
    slow: number;
    unattempted: number;
    subtopics: Record<string, { count: number; wrong: number; slow: number; concepts: Set<string> }>;
    // #2 time trap tracking
    totalUserTime: number;
    totalAvgTime: number;
    timedQuestions: number;
    // #5 cross-mock recurrence
    seenInMocks: Set<string>;
  }

  const topicErrors: Record<string, TopicErrorEntry> = {};

  if (mockErrorsData) {
    Object.entries(mockErrorsData).forEach(([subject, chapters]) => {
      if (Array.isArray(chapters)) {
        chapters.forEach(ch => {
          const chTitle = (ch.chapter_title || '').toLowerCase();
          const isWrong = chTitle.includes('wrong');
          const isSlow = chTitle.includes('speed') || chTitle.includes('slow');
          const isUnattempted = chTitle.includes('unattempt');
          const qs = ch.questions || [];
          qs.forEach((q: any) => {
            const rawTopic = q.tags?.topic || q.topic;
            const topic = normalizeTopicTitle(rawTopic);
            const rawSubtopic = q.tags?.subtopic || q.subtopic || topic;
            const subtopic = normalizeTopicTitle(rawSubtopic);
            const concept = (q.tags?.conceptTested || q.conceptTested || '').trim();
            const mockName: string = ch.chapter_title || subject;

            // #2 time data
            const uTime = Number(q.userTime || q.user_time || 0);
            const aTime = Number(q.avgTime || q.avg_time || q.avgTimeSeconds || 0);

            if (topic && topic !== 'General') {
              const key = `${subject} • ${topic}`;
              if (!topicErrors[key]) {
                topicErrors[key] = {
                  topic, subject, count: 0, wrong: 0, slow: 0, unattempted: 0,
                  subtopics: {},
                  totalUserTime: 0, totalAvgTime: 0, timedQuestions: 0,
                  seenInMocks: new Set()
                };
              }
              const entry = topicErrors[key];
              entry.count += 1;
              entry.seenInMocks.add(mockName);

              if (isWrong || (q.status && q.status.toLowerCase().includes('wrong'))) entry.wrong += 1;
              else if (isSlow || (q.status && (q.status.toLowerCase().includes('slow') || q.status.toLowerCase().includes('speed')))) entry.slow += 1;
              else if (isUnattempted || (q.status && q.status.toLowerCase().includes('unattempt'))) entry.unattempted += 1;

              // Time accumulation
              if (uTime > 0 && aTime > 0) {
                entry.totalUserTime += uTime;
                entry.totalAvgTime += aTime;
                entry.timedQuestions++;
              }

              // #9: Subtopic breakdown
              if (!entry.subtopics[subtopic]) {
                entry.subtopics[subtopic] = { count: 0, wrong: 0, slow: 0, concepts: new Set() };
              }
              const sub = entry.subtopics[subtopic];
              sub.count++;
              if (isWrong || (q.status && q.status.toLowerCase().includes('wrong'))) sub.wrong++;
              if (isSlow || (q.status && (q.status.toLowerCase().includes('slow') || q.status.toLowerCase().includes('speed')))) sub.slow++;
              if (concept.length > 2) sub.concepts.add(concept);
            }
          });
        });
      }
    });
  }

  // Sort by error count
  const sortedTopicEntries = Object.values(topicErrors).sort((a, b) => b.count - a.count);
  const totalAllErrors = sortedTopicEntries.reduce((s, t) => s + t.count, 0);

  // ── #2: Time-Trap topics (userTime > 1.8× avgTime) ──────────────────────────
  const timeTrapTopics = sortedTopicEntries
    .filter(t => t.timedQuestions >= 2 && t.totalAvgTime > 0 && (t.totalUserTime / t.totalAvgTime) >= 1.8)
    .map(t => {
      const ratio = Math.round((t.totalUserTime / t.totalAvgTime) * 10) / 10;
      const avgU = Math.round(t.totalUserTime / t.timedQuestions);
      const avgA = Math.round(t.totalAvgTime / t.timedQuestions);
      return `- ${t.subject} → ${t.topic}: You avg ${avgU}s vs Platform avg ${avgA}s (${ratio}× slower — Time Trap [T] risk)`;
    });

  // ── #4: Marks Recovery Projection ──────────────────────────────────────────
  // For each topic: if we convert 60% of wrong Qs → +2 marks each, save 0.5 negative each
  const marksRecovery = sortedTopicEntries
    .filter(t => t.wrong >= 2)
    .slice(0, 8)
    .map(t => {
      const convertible = Math.ceil(t.wrong * 0.6);
      const recovery = Math.round((convertible * 2 + t.wrong * 0.5) * 10) / 10;
      return `- ${t.subject} → ${t.topic}: ${t.wrong} wrong Qs → Fix 60% = +${recovery} marks recoverable`;
    });

  // ── #5: Cross-Mock Recurrence ───────────────────────────────────────────────
  const recurringTopics = sortedTopicEntries
    .filter(t => t.seenInMocks.size >= 2)
    .slice(0, 10)
    .map(t => `- ${t.subject} → ${t.topic}: Appeared in ${t.seenInMocks.size} different mocks (${t.count} total errors) ⚠️ RECURRING`);

  // ── Build readable top weak topics with subtopic detail (#9) ────────────────
  const topWeakTopics = sortedTopicEntries.slice(0, 15).map(t => {
    const pct = totalAllErrors > 0 ? Math.round((t.count / totalAllErrors) * 1000) / 10 : 0;
    let line = `- ${t.subject} → ${t.topic}: ${t.count} total questions (${t.wrong} Wrong, ${t.slow} Slow, ${t.unattempted} Skipped) [${pct}% of all errors]`;
    // Add subtopics if there are multiple distinct ones
    const subtopicEntries = Object.entries(t.subtopics).filter(([k]) => k !== t.topic);
    if (subtopicEntries.length > 0) {
      const subLines = subtopicEntries
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([name, sub]) => {
          const conceptStr = sub.concepts.size > 0 ? ` | Concepts: ${Array.from(sub.concepts).slice(0, 2).join('; ')}` : '';
          return `    ↳ ${name}: ${sub.count} errors (${sub.wrong} Wrong)${conceptStr}`;
        });
      line += '\n' + subLines.join('\n');
    }
    return line;
  });

  // Chronological Full Mocks Detailed Log (Newest to Oldest)
  const sortedFullMocks = [...fullMocks].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const fullMocksLog = sortedFullMocks.map((r, i) => {
    const dateStr = r.date ? new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent';
    return `- Full Mock #${sortedFullMocks.length - i} ("${r.title}", Date: ${dateStr}): Score: ${r.totalScore}/200 (Acc: ${r.overallAccuracy}%) | Correct: ${r.totalCorrect}, Wrong: ${r.totalWrong}, Skipped: ${r.totalUnattempted}`;
  });

  // ── #1: Score Trend Analysis ────────────────────────────────────────────────
  let scoreTrendBlock = '';
  if (sortedFullMocks.length >= 2) {
    // Oldest → Newest for trend direction
    const chronoScores = [...sortedFullMocks].reverse().map(r => r.totalScore || 0);
    const trendDelta = chronoScores[chronoScores.length - 1] - chronoScores[0];
    const last3 = chronoScores.slice(-3);
    const trendDir = trendDelta > 5 ? '📈 IMPROVING' : trendDelta < -5 ? '📉 DECLINING' : '➡️ STAGNANT';

    // Section trends — check if latest mock is better than earliest
    const sectionTrends: string[] = [];
    const sectionKeys = ['reasoning', 'mathematics', 'english', 'generalAwareness'] as const;
    const sectionLabels: Record<string, string> = {
      reasoning: 'Reasoning', mathematics: 'Mathematics',
      english: 'English', generalAwareness: 'General Awareness'
    };
    sectionKeys.forEach(key => {
      const withSection = sortedFullMocks.filter(r => r.sections?.[key]?.score !== undefined);
      if (withSection.length >= 2) {
        const oldest = withSection[withSection.length - 1].sections![key]!.score;
        const latest = withSection[0].sections![key]!.score;
        const delta = latest - oldest;
        if (Math.abs(delta) >= 3) {
          sectionTrends.push(`  • ${sectionLabels[key]}: ${oldest} → ${latest} (${delta >= 0 ? '+' : ''}${delta} pts)`);
        }
      }
    });

    scoreTrendBlock = `
SCORE TREND ANALYSIS (${trendDir}):
• Score trajectory (oldest → newest): ${chronoScores.join(' → ')}
• Last 3 full mocks: ${last3.join(' → ')} | Net change vs first mock: ${trendDelta >= 0 ? '+' : ''}${trendDelta} marks
${sectionTrends.length > 0 ? 'Section-wise movement:\n' + sectionTrends.join('\n') : ''}
${trendDir === '📉 DECLINING' ? '⚠️ Score is declining — likely cause: exam fatigue or insufficient concept revision. Prioritize quality over quantity of mocks.' : ''}
${trendDir === '➡️ STAGNANT' ? '⚠️ Score is stagnant — candidate may need to shift strategy: focus on converting known-concept questions (Silly Mistakes [A]) and time management.' : ''}`;
  }

  // Recent 10 Mocks (All types)
  const sortedReports = [...reports].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const recentMocksLog = sortedReports.slice(0, 12).map(r => {
    const dateStr = r.date ? new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
    return `- "${r.title}" (${dateStr || r.type}): Score: ${r.totalScore}/${r.maxMarks || (r.type === 'full' ? 200 : 50)} | Acc: ${r.overallAccuracy}% | Correct: ${r.totalCorrect}, Wrong: ${r.totalWrong}`;
  });

  let summary = `=== CANDIDATE MOCK TEST PERFORMANCE PROFILE ===
• Total Tests Recorded: ${reports.length} Mocks
  - Full-Length Mocks: ${fullMocks.length} tests (Average Score: ${fullAvgScore}/200 | Highest Score: ${fullHighestScore}/200)
  - Mathematics Sectionals: ${mathSectionals.length} tests (Average Score: ${getSecAvg(mathSectionals)}/50 | Highest: ${mathSectionals.length > 0 ? Math.max(...mathSectionals.map(m => m.totalScore)) : 0}/50)
  - English Sectionals: ${englishSectionals.length} tests (Average Score: ${getSecAvg(englishSectionals)}/50 | Highest: ${englishSectionals.length > 0 ? Math.max(...englishSectionals.map(m => m.totalScore)) : 0}/50)
  - Reasoning Sectionals: ${reasoningSectionals.length} tests
  - General Awareness Sectionals: ${gaSectionals.length} tests
${scoreTrendBlock}
ALL FULL-LENGTH MOCKS RECORDED IN PORTAL (${fullMocks.length} tests):
${fullMocksLog.length > 0 ? fullMocksLog.join('\n') : '- No full-length mocks recorded yet.'}

OVERALL SECTION ACCURACY & SCORING PERFORMANCE:
${sectionLines.length > 0 ? sectionLines.join('\n') : '- No section breakdown recorded.'}

TOP WEAKEST TOPICS IDENTIFIED WITH SUBTOPIC BREAKDOWN (Major Error Hotspots):
${topWeakTopics.length > 0 ? topWeakTopics.join('\n') : '- Topic error patterns not heavily populated.'}

RECENT MOCKS ACTIVITY:
${recentMocksLog.join('\n')}`;

  // ── #5: Cross-Mock Recurring Weakness Block ──────────────────────────────────
  if (recurringTopics.length > 0) {
    summary += `\n\nCROSS-MOCK RECURRING WEAKNESSES (Topics that keep appearing across multiple mocks — HIGHEST PRIORITY):
${recurringTopics.join('\n')}
(These topics MUST be given dedicated concept-revision sessions, not just more practice drills!)`;
  }

  // ── #2: Time Trap Topics Block ───────────────────────────────────────────────
  if (timeTrapTopics.length > 0) {
    summary += `\n\nTIME TRAP TOPICS (You are spending significantly MORE time than platform average — marks loss from speed):
${timeTrapTopics.join('\n')}
(For these topics: either learn the shortcut trick / elimination method, OR practice a strict 90-second rule and move on.)`;
  }

  // ── #4: Marks Recovery Block ─────────────────────────────────────────────────
  if (marksRecovery.length > 0) {
    summary += `\n\nMARKS RECOVERY OPPORTUNITY (If candidate fixes 60% of wrong questions per topic):
${marksRecovery.join('\n')}
(Total potential marks recovery if ALL are fixed: +${Math.round(sortedTopicEntries.filter(t => t.wrong >= 2).slice(0, 8).reduce((s, t) => s + Math.round((Math.ceil(t.wrong * 0.6) * 2 + t.wrong * 0.5) * 10) / 10, 0) * 10) / 10} marks)`;
  }

  // Ingest RCA Classification Data & Silly Mistake Logs
  try {
    if (typeof window !== 'undefined') {
      const rcaRaw = window.localStorage?.getItem('cgl_rca_global_store');
      if (rcaRaw) {
        const rcaStore = JSON.parse(rcaRaw);
        const entries = Object.values(rcaStore) as any[];
        if (entries.length > 0) {
          const counts = { C: 0, S: 0, T: 0, G: 0 };
          const sillyNotes: string[] = [];

          entries.forEach(item => {
            const effectiveTag = item?.tag === 'A' ? 'S' : item?.tag;
            if (effectiveTag && counts[effectiveTag as keyof typeof counts] !== undefined) {
              counts[effectiveTag as keyof typeof counts]++;
            }
            if ((item?.tag === 'S' || item?.tag === 'A') && item?.sillyMistakeNote && typeof item.sillyMistakeNote === 'string' && item.sillyMistakeNote.trim()) {
              const topicStr = item.topic ? `[${item.subject || 'General'} • ${item.topic}]` : '';
              sillyNotes.push(`${topicStr} "${item.sillyMistakeNote.trim()}"`);
            }
          });

          summary += `\n\nROOT CAUSE ANALYSIS (RCA) ERROR AUDIT:
• Total Classified Errors: ${entries.length} questions
  - [C] Conceptual Gaps: ${counts.C} questions (formulas forgotten / concepts unclear)
  - [S] Silly Mistakes: ${counts.S} questions (calculation slip, misread question, rushed)
  - [T] Time / Ego Traps: ${counts.T} questions (spent too much time / failed to skip early)
  - [G] Guesswork Failed: ${counts.G} questions (50-50 hunch went wrong)`;

          if (sillyNotes.length > 0) {
            summary += `\n\nCANDIDATE'S RECORDED SILLY MISTAKE LOG (Exact student notes):
${sillyNotes.slice(-6).map(n => `- ${n}`).join('\n')}
(Help the candidate overcome these specific recurring calculation or comprehension habits!)`;
          }
        }
      }
    }
  } catch {}

  if (activeMockReport) {
    summary += `\n\nCURRENTLY ACTIVE MOCK REPORT BEING REVIEWED BY CANDIDATE:
• Mock Title: "${activeMockReport.title}"
• Score: ${activeMockReport.totalScore}/${activeMockReport.maxMarks || 200} (Accuracy: ${activeMockReport.overallAccuracy}%)
• Correct: ${activeMockReport.totalCorrect}, Wrong: ${activeMockReport.totalWrong}, Skipped: ${activeMockReport.totalUnattempted}
If the user asks questions referring to "this mock" or "my last mock", prioritize this active test.`;
  }

  return summary;
}
