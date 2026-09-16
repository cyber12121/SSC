import { AiFocusedScope } from '../types/aiScope';

export const AI_SCOPE_EVENT = 'cgl_open_ai_scope';

export function openAiWithScope(scope: AiFocusedScope) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AI_SCOPE_EVENT, { detail: scope }));
  }
}
