import { AiFocusedScope } from '../types/aiScope';

export const AI_SCOPE_EVENT = 'cgl_open_ai_scope';
export const AI_SCOPE_BATCH_SIZE = 100;

export function openAiWithScope(scope: AiFocusedScope) {
  if (typeof window !== 'undefined') {
    const rawQuestions = scope.questions || [];
    const totalCount = rawQuestions.length;

    if (totalCount > AI_SCOPE_BATCH_SIZE) {
      const totalBatches = Math.ceil(totalCount / AI_SCOPE_BATCH_SIZE);
      const batch1 = rawQuestions.slice(0, AI_SCOPE_BATCH_SIZE);
      const batchedScope: AiFocusedScope = {
        ...scope,
        allQuestions: rawQuestions,
        questions: batch1,
        currentBatch: 1,
        totalBatches,
        batchSize: AI_SCOPE_BATCH_SIZE,
        stats: {
          ...scope.stats,
          totalQuestions: scope.stats?.totalQuestions || totalCount
        }
      };
      window.dispatchEvent(new CustomEvent(AI_SCOPE_EVENT, { detail: batchedScope }));
      return;
    }

    const standardScope: AiFocusedScope = {
      ...scope,
      allQuestions: rawQuestions,
      currentBatch: 1,
      totalBatches: 1,
      batchSize: AI_SCOPE_BATCH_SIZE,
      stats: {
        ...scope.stats,
        totalQuestions: scope.stats?.totalQuestions || totalCount
      }
    };
    window.dispatchEvent(new CustomEvent(AI_SCOPE_EVENT, { detail: standardScope }));
  }
}
