import { TelegramQuizQuestion } from './quizData';

export interface UserQuizSession {
  userId: number;
  chatId: number;
  drillTitle: string;
  questions: TelegramQuizQuestion[];
  currentIndex: number;
  score: number;
  startTime: number;
  activePollId?: string;
  answeredCount: number;
}

// In-memory sessions mapped by userId
const sessions = new Map<number, UserQuizSession>();

// Secondary index: pollId -> userId for ultra-fast poll_answer lookup
const pollToUserMap = new Map<string, number>();

export function startSession(
  userId: number,
  chatId: number,
  drillTitle: string,
  questions: TelegramQuizQuestion[]
): UserQuizSession {
  const session: UserQuizSession = {
    userId,
    chatId,
    drillTitle,
    questions,
    currentIndex: 0,
    score: 0,
    startTime: Date.now(),
    answeredCount: 0,
  };
  sessions.set(userId, session);
  return session;
}

export function getSession(userId: number): UserQuizSession | undefined {
  return sessions.get(userId);
}

export function registerActivePoll(pollId: string, userId: number) {
  pollToUserMap.set(pollId, userId);
  const session = sessions.get(userId);
  if (session) {
    session.activePollId = pollId;
  }
}

export function getSessionByPollId(pollId: string): UserQuizSession | undefined {
  const userId = pollToUserMap.get(pollId);
  if (!userId) return undefined;
  return sessions.get(userId);
}

export function clearSession(userId: number) {
  const session = sessions.get(userId);
  if (session?.activePollId) {
    pollToUserMap.delete(session.activePollId);
  }
  sessions.delete(userId);
}
