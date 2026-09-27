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
  missedQuestions?: TelegramQuizQuestion[];
}

// In-memory sessions mapped by userId
const sessions = new Map<number, UserQuizSession>();

// Secondary index: pollId -> userId for ultra-fast poll_answer lookup
const pollToUserMap = new Map<string, number>();

import fs from 'fs';
import path from 'path';
import os from 'os';

const TMP_FILE = path.join(os.tmpdir(), 'cgl_bot_sessions.json');

function saveToDisk() {
  try {
    const data = {
      sessions: Array.from(sessions.entries()),
      pollMap: Array.from(pollToUserMap.entries()),
    };
    fs.writeFileSync(TMP_FILE, JSON.stringify(data), 'utf8');
  } catch {}
}

function loadFromDisk() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
      if (parsed.sessions) {
        for (const [k, v] of parsed.sessions) sessions.set(Number(k), v);
      }
      if (parsed.pollMap) {
        for (const [k, v] of parsed.pollMap) pollToUserMap.set(String(k), Number(v));
      }
    }
  } catch {}
}

loadFromDisk();

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
    missedQuestions: [],
  };
  sessions.set(userId, session);
  saveToDisk();
  return session;
}

export function getSession(userId: number): UserQuizSession | undefined {
  if (!sessions.has(userId)) loadFromDisk();
  return sessions.get(userId);
}

export function registerActivePoll(pollId: string, userId: number) {
  pollToUserMap.set(pollId, userId);
  const session = sessions.get(userId);
  if (session) {
    session.activePollId = pollId;
  }
  saveToDisk();
}

export function getSessionByPollId(pollId: string): UserQuizSession | undefined {
  let userId = pollToUserMap.get(pollId);
  if (!userId) {
    loadFromDisk();
    userId = pollToUserMap.get(pollId);
  }
  if (!userId) return undefined;
  return sessions.get(userId);
}

export function saveSession(session: UserQuizSession) {
  sessions.set(session.userId, session);
  saveToDisk();
}

export function clearSession(userId: number) {
  const session = sessions.get(userId);
  if (session?.activePollId) {
    pollToUserMap.delete(session.activePollId);
  }
  sessions.delete(userId);
  saveToDisk();
}

