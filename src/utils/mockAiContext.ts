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

  // Topic-level errors across mock error questions
  const topicErrors: Record<string, { topic: string; subject: string; count: number }> = {};
  if (mockErrorsData) {
    Object.entries(mockErrorsData).forEach(([subject, chapters]) => {
      if (Array.isArray(chapters)) {
        chapters.forEach(ch => {
          const isWrong = (ch.chapter_title || '').toLowerCase().includes('wrong');
          const qs = ch.questions || [];
          qs.forEach((q: any) => {
            const rawTopic = q.tags?.topic || q.topic;
            const topic = normalizeTopicTitle(rawTopic);
            if (topic && topic !== 'General') {
              const key = `${subject} • ${topic}`;
              if (!topicErrors[key]) {
                topicErrors[key] = { topic, subject, count: 0 };
              }
              if (isWrong || (q.status && q.status.toLowerCase().includes('wrong'))) {
                topicErrors[key].count += 1;
              } else {
                topicErrors[key].count += 0.5;
              }
            }
          });
        });
      }
    });
  }

  const topWeakTopics = Object.values(topicErrors)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(t => `- ${t.subject} -> ${t.topic} (~${Math.round(t.count)} error occurrences)`);

  // Recent 6 Mocks detailed log
  const recentMocks = [...reports]
    .slice(-8)
    .reverse()
    .map(r => `- "${r.title}": Score: ${r.totalScore}/${r.maxMarks || (r.type === 'full' ? 200 : 50)} | Acc: ${r.overallAccuracy}% | Correct: ${r.totalCorrect}, Wrong: ${r.totalWrong}`);

  let summary = `=== CANDIDATE MOCK TEST PERFORMANCE PROFILE ===
• Total Tests Recorded: ${reports.length} Mocks
  - Full-Length Mocks: ${fullMocks.length} tests (Average Score: ${fullAvgScore}/200 | Highest Score: ${fullHighestScore}/200)
  - Mathematics Sectionals: ${mathSectionals.length} tests (Average Score: ${getSecAvg(mathSectionals)}/50 | Highest: ${mathSectionals.length > 0 ? Math.max(...mathSectionals.map(m => m.totalScore)) : 0}/50)
  - English Sectionals: ${englishSectionals.length} tests (Average Score: ${getSecAvg(englishSectionals)}/50 | Highest: ${englishSectionals.length > 0 ? Math.max(...englishSectionals.map(m => m.totalScore)) : 0}/50)
  - Reasoning Sectionals: ${reasoningSectionals.length} tests
  - General Awareness Sectionals: ${gaSectionals.length} tests

OVERALL SECTION ACCURACY & SCORING PERFORMANCE:
${sectionLines.length > 0 ? sectionLines.join('\n') : '- No section breakdown recorded.'}

TOP WEAKEST TOPICS IDENTIFIED (Major Error Hotspots):
${topWeakTopics.length > 0 ? topWeakTopics.join('\n') : '- Topic error patterns not heavily populated.'}

RECENT MOCK RESULTS LOG:
${recentMocks.join('\n')}`;

  // Ingest RCA Classification Data & Silly Mistake Logs
  try {
    if (typeof window !== 'undefined') {
      const rcaRaw = window.localStorage?.getItem('cgl_rca_global_store');
      if (rcaRaw) {
        const rcaStore = JSON.parse(rcaRaw);
        const entries = Object.values(rcaStore) as any[];
        if (entries.length > 0) {
          const counts = { C: 0, A: 0, T: 0, G: 0 };
          const sillyNotes: string[] = [];

          entries.forEach(item => {
            if (item?.tag && counts[item.tag as keyof typeof counts] !== undefined) {
              counts[item.tag as keyof typeof counts]++;
            }
            if (item?.tag === 'A' && item?.sillyMistakeNote && typeof item.sillyMistakeNote === 'string' && item.sillyMistakeNote.trim()) {
              const topicStr = item.topic ? `[${item.subject || 'General'} • ${item.topic}]` : '';
              sillyNotes.push(`${topicStr} "${item.sillyMistakeNote.trim()}"`);
            }
          });

          summary += `\n\nROOT CAUSE ANALYSIS (RCA) ERROR AUDIT:
• Total Classified Errors: ${entries.length} questions
  - [C] Conceptual Gaps: ${counts.C} questions (formulas forgotten / concepts unclear)
  - [A] Silly Mistakes: ${counts.A} questions (calculation slip, misread question, rushed)
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
