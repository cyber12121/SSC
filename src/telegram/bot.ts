import { Bot, InlineKeyboard } from 'grammy';
import dotenv from 'dotenv';
import {
  generateMixedSpeedDrill,
  generateTripletsDrill,
  generateFractionsDrill,
  generateSquaresDrill,
  getSimplificationDrill,
  sanitizeTelegramQuiz,
  TelegramQuizQuestion,
} from './quizData';
import {
  getTripletsStepDrill,
  getTablesStepDrill,
  getSquaresStepDrill,
  getCubesStepDrill,
  getPowersStepDrill,
  getFactorialsStepDrill,
  getFractionsStepDrill,
  getDailyRoutineWorkout,
  getSimplificationCatalog,
} from './speedLabData';
import {
  getEnglishCatalog,
  getMathCatalog,
  getGeneralAwarenessCatalog,
  getMockErrorsCatalog,
  loadQuestionsFromSet,
  loadMockErrorsForSubject,
  registerAction,
  getAction,
  SetEntry,
  TopicEntry,
  SectionEntry,
} from './catalog';
import {
  startSession,
  getSession,
  clearSession,
  registerActivePoll,
  getSessionByPollId,
  UserQuizSession,
} from './quizSession';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('[TelegramBot] TELEGRAM_BOT_TOKEN is not defined in .env!');
}

export const bot = new Bot(token || '');

// ----------------------------------------------------
// WEBSITE-MIRRORING NAVIGATION KEYBOARDS
// ----------------------------------------------------

function getRootMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📁 Chapter Bank', 'nav_chapter_bank')
    .row()
    .text('🎯 Mock Errors', 'nav_mock_errors')
    .row()
    .text('⚡ Speed Lab', 'nav_speed_lab')
    .row()
    .text('💡 Help & Commands', 'nav_help');
}

function getChapterBankSubjectsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📐 Mathematics', 'cb_sub_math')
    .text('🧠 Reasoning', 'cb_sub_reasoning')
    .row()
    .text('📖 English', 'cb_sub_english')
    .text('🏛️ General Awareness', 'cb_sub_ga')
    .row()
    .text('⬅️ Back to Main Menu', 'nav_root');
}

// ----------------------------------------------------
// QUIZ ENGINE DISPATCH
// ----------------------------------------------------

async function sendCurrentQuestion(botInstance: Bot, session: UserQuizSession) {
  if (session.currentIndex >= session.questions.length) {
    await sendCompletionSummary(botInstance, session);
    return;
  }

  const q = session.questions[session.currentIndex];
  const qNum = session.currentIndex + 1;
  const total = session.questions.length;

  if (q.preamble) {
    try {
      await botInstance.api.sendMessage(session.chatId, q.preamble, { parse_mode: 'Markdown' });
    } catch {}
  }

  const header = `[Q ${qNum}/${total}]`;
  const formattedQuestion = `${header} ${q.question}`;

  try {
    const pollMsg = await botInstance.api.sendPoll(
      session.chatId,
      formattedQuestion.slice(0, 298),
      q.options,
      {
        type: 'quiz',
        correct_option_ids: [q.correctOptionIndex],
        correct_option_id: q.correctOptionIndex,
        explanation: q.explanation || undefined,
        is_anonymous: false,
      } as any
    );

    registerActivePoll(pollMsg.poll.id, session.userId);
  } catch (err: any) {
    console.error(`[TelegramBot] Error sending quiz poll (Q${qNum}):`, err?.message || err);
    await botInstance.api.sendMessage(
      session.chatId,
      `⚠️ Could not display in quiz poll format:\n\n${q.question}\n\n*Moving to next question...*`,
      { parse_mode: 'Markdown' }
    );
    session.currentIndex++;
    await sendCurrentQuestion(botInstance, session);
  }
}

async function sendCompletionSummary(botInstance: Bot, session: UserQuizSession) {
  const durationSec = Math.max(1, Math.round((Date.now() - session.startTime) / 1000));
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const timeFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const total = session.questions.length;
  const score = session.score;
  const percentage = Math.round((score / total) * 100);
  const speedPerQ = (durationSec / total).toFixed(1);

  let medal = '🎯';
  let comment = '';
  if (percentage >= 90) {
    medal = '🏆 OUTSTANDING PERFORMANCE!';
    comment = 'Flawless accuracy! Your concepts in this set are rock solid!';
  } else if (percentage >= 70) {
    medal = '🔥 WELL DONE!';
    comment = 'Great score! Review the couple of questions you missed.';
  } else if (percentage >= 50) {
    medal = '👍 GOOD PROGRESS!';
    comment = 'Solid foundation, practice this set once more for mastery.';
  } else {
    medal = '💪 KEEP WORKING!';
    comment = 'Revisit the solutions and repeat the set to build confidence.';
  }

  const report =
    `${medal}\n\n` +
    `*${session.drillTitle}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 *Total Score:* ${score} / ${total} (${percentage}%)\n` +
    `⏱️ *Time Taken:* ${timeFormatted}\n` +
    `⚡ *Average Pace:* ${speedPerQ}s / question\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `_${comment}_\n\n` +
    `*Where to next?*`;

  const afterQuizKeyboard = new InlineKeyboard()
    .text('📁 Chapter Bank', 'nav_chapter_bank')
    .text('🎯 Mock Errors', 'nav_mock_errors')
    .row()
    .text('⚡ Speed Lab', 'nav_speed_lab')
    .text('🏠 Main Menu', 'nav_root');

  clearSession(session.userId);

  await botInstance.api.sendMessage(session.chatId, report, {
    parse_mode: 'Markdown',
    reply_markup: afterQuizKeyboard,
  });
}

function startQuizForUser(
  userId: number,
  chatId: number,
  title: string,
  questions: TelegramQuizQuestion[]
) {
  if (!questions || questions.length === 0) {
    bot.api.sendMessage(
      chatId,
      `⚠️ No questions found for *${title}*. Please choose another section.`,
      {
        parse_mode: 'Markdown',
        reply_markup: getRootMenuKeyboard(),
      }
    );
    return;
  }

  const session = startSession(userId, chatId, title, questions);
  bot.api.sendMessage(
    chatId,
    `🚀 *${title}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Questions:* ${questions.length} Questions\n` +
      `💡 _Tap an answer on each quiz card below._\n` +
      `🛑 _Type /stop anytime to end early and see your score._`,
    { parse_mode: 'Markdown' }
  );

  sendCurrentQuestion(bot, session);
}

// ----------------------------------------------------
// COMMAND HANDLERS
// ----------------------------------------------------

bot.command(['start', 'menu'], async (ctx) => {
  const name = ctx.from?.first_name || 'Aspirant';
  const text =
    `👋 *Welcome ${name} to your CGL Preparation Cockpit!*\n\n` +
    `Browse everything just like the website:\n` +
    `• 📁 *Chapter Bank:* Math, Reasoning, English (Black Book & Ayush), GA\n` +
    `• 🎯 *Mock Errors:* Revise mistakes by subject & chapter\n` +
    `• ⚡ *Speed Lab:* Triplets, Fractions, Squares, Simplification\n\n` +
    `👉 *Select an area to explore:*`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: getRootMenuKeyboard(),
  });
});

bot.command('stop', async (ctx) => {
  const session = getSession(ctx.from!.id);
  if (!session) {
    await ctx.reply('No active quiz is currently running. Send /menu to start one!');
    return;
  }
  await sendCompletionSummary(bot, session);
});

bot.command('help', async (ctx) => {
  const helpText =
    `💡 *CGL Bot Guide*\n\n` +
    `• /start or /menu — Open the main category menu\n` +
    `• /stop — Finish active test and generate score card\n\n` +
    `*How it works:*\n` +
    `1. Select Chapter Bank or Mock Errors\n` +
    `2. Pick your subject and topic\n` +
    `3. Choose a Set — then pick **Attempt ALL Questions** (full set) or **Quick 10**!\n` +
    `4. Instant feedback and solutions appear automatically as you tap.`;

  await ctx.reply(helpText, {
    parse_mode: 'Markdown',
    reply_markup: getRootMenuKeyboard(),
  });
});

// ----------------------------------------------------
// LEVEL 1: ROOT & CHAPTER BANK SUBJECTS
// ----------------------------------------------------

bot.callbackQuery('nav_root', async (ctx) => {
  await ctx.editMessageText('👉 *Select an area to explore:*', {
    parse_mode: 'Markdown',
    reply_markup: getRootMenuKeyboard(),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('nav_chapter_bank', async (ctx) => {
  await ctx.editMessageText('📁 *Chapter Bank:* Select a subject:', {
    parse_mode: 'Markdown',
    reply_markup: getChapterBankSubjectsKeyboard(),
  });
  await ctx.answerCallbackQuery();
});

// ----------------------------------------------------
// LEVEL 2: ENGLISH CHAPTER BANK (Black Book vs Ayush)
// ----------------------------------------------------

bot.callbackQuery('cb_sub_english', async (ctx) => {
  const sections = getEnglishCatalog();
  const kb = new InlineKeyboard();

  for (const sec of sections) {
    const actId = registerAction({ type: 'eng_sec', secId: sec.id });
    kb.text(sec.title, actId).row();
  }
  kb.text('⬅️ Back to Subjects', 'nav_chapter_bank');

  await ctx.editMessageText('📖 *English Chapter Bank:* Choose a book/source:', {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
  await ctx.answerCallbackQuery();
});

// ----------------------------------------------------
// LEVEL 2: MATHEMATICS CHAPTER BANK
// ----------------------------------------------------

bot.callbackQuery('cb_sub_math', async (ctx) => {
  const mathSections = getMathCatalog();
  const kb = new InlineKeyboard();

  for (const sec of mathSections) {
    const actId = registerAction({ type: 'math_sec', secId: sec.id });
    kb.text(sec.title, actId).row();
  }
  kb.text('⬅️ Back to Subjects', 'nav_chapter_bank');

  await ctx.editMessageText('📐 *Mathematics Chapter Bank:* Select module:', {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
  await ctx.answerCallbackQuery();
});

// ----------------------------------------------------
// LEVEL 2: GENERAL AWARENESS CHAPTER BANK
// ----------------------------------------------------

bot.callbackQuery('cb_sub_ga', async (ctx) => {
  const topics = getGeneralAwarenessCatalog();
  const kb = new InlineKeyboard();

  for (let i = 0; i < topics.length; i += 2) {
    const t1 = topics[i];
    const t2 = topics[i + 1];

    const act1 = registerAction({ type: 'ga_topic', topicId: t1.id });
    kb.text(t1.title, act1);

    if (t2) {
      const act2 = registerAction({ type: 'ga_topic', topicId: t2.id });
      kb.text(t2.title, act2);
    }
    kb.row();
  }
  kb.text('⬅️ Back to Subjects', 'nav_chapter_bank');

  await ctx.editMessageText('🏛️ *General Awareness:* Select a subject:', {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
  await ctx.answerCallbackQuery();
});

// ----------------------------------------------------
// LEVEL 2: REASONING CHAPTER BANK
// ----------------------------------------------------

bot.callbackQuery('cb_sub_reasoning', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('🎯 Reasoning Mock Mistakes (All Sets)', 'start_mock_err_reasoning')
    .row()
    .text('⬅️ Back to Subjects', 'nav_chapter_bank');

  await ctx.editMessageText(
    '🧠 *Reasoning Bank:*\nSelect practice mode below:',
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
  await ctx.answerCallbackQuery();
});

// ----------------------------------------------------
// MOCK ERRORS ROOT & SUBJECTS
// ----------------------------------------------------

bot.callbackQuery('nav_mock_errors', async (ctx) => {
  const catalog = getMockErrorsCatalog();
  const kb = new InlineKeyboard();

  for (const item of catalog) {
    const actId = registerAction({ type: 'mock_sub', subId: item.subjectId });
    kb.text(`${item.title} (${item.totalQuestions} Qs)`, actId).row();
  }
  kb.text('⬅️ Back to Main Menu', 'nav_root');

  await ctx.editMessageText(
    '🎯 *Mock Errors Bank:*\nReview all mistakes you made in full test series.\n\nSelect a subject:',
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
  await ctx.answerCallbackQuery();
});

// ----------------------------------------------------
// SPEED LAB NAVIGATION
// ----------------------------------------------------

bot.callbackQuery('nav_speed_lab', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('🧮 Calculation Studio (7 Steps)', 'speed_calc_studio')
    .row()
    .text('📐 Simplification Drills', 'speed_simp_menu')
    .row()
    .text('🏆 Daily 25-Q Routine Workout', 'speed_routine')
    .row()
    .text('⚡ Rapid 10-Q Speed Blitz', 'speed_mixed')
    .row()
    .text('⬅️ Back to Main Menu', 'nav_root');

  await ctx.editMessageText(
    '⚡ *Speed Lab (Same as Website):*\n\n' +
      '• *Calculation Studio:* Master all 7 building blocks\n' +
      '• *Simplification Drills:* Easy, Moderate, & Hard sets\n' +
      '• *Daily Workout:* 25 questions testing all 7 steps\n\n' +
      '👉 *Choose your speed training mode:*',
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
  await ctx.answerCallbackQuery();
});

// Calculation Studio 7 Steps
bot.callbackQuery('speed_calc_studio', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('Step 1: 📐 Triplets (16 Qs)', 'calc_step_triplets')
    .row()
    .text('Step 2: ✖️ Tables 12–24 (13 Qs)', 'calc_step_tables')
    .row()
    .text('Step 3: 🔢 Squares 17–39 (23 Qs)', 'calc_step_squares')
    .row()
    .text('Step 4: 🧊 Cubes 11–25 (15 Qs)', 'calc_step_cubes')
    .row()
    .text('Step 5: ⚡ Powers 2–9 (38 Qs)', 'calc_step_powers')
    .row()
    .text('Step 6: ❗ Factorials 1–8 (8 Qs)', 'calc_step_factorials')
    .row()
    .text('Step 7: 💯 Fractions % (73 Qs)', 'calc_step_fractions')
    .row()
    .text('⬅️ Back to Speed Lab', 'nav_speed_lab');

  await ctx.editMessageText(
    '🧮 *Calculation Studio (7 Steps)*\n━━━━━━━━━━━━━━━━━━━━━━\nSelect a step to master:',
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
  await ctx.answerCallbackQuery();
});

// Step Handlers (with All vs 10 choice)
function renderStepOptions(title: string, total: number, stepCode: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(`🚀 Practice ALL (${total} Questions)`, `run_calc_${stepCode}_all`)
    .row()
    .text('⚡ Quick 10 Questions', `run_calc_${stepCode}_10`)
    .row()
    .text('⬅️ Back to Steps', 'speed_calc_studio');
}

bot.callbackQuery('calc_step_triplets', async (ctx) => {
  await ctx.editMessageText(
    '📐 *Step 1: Primitive Triplets*\nTotal Questions: *16 Triplets*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Triplets', 16, 'triplets') }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_tables', async (ctx) => {
  await ctx.editMessageText(
    '✖️ *Step 2: Multiplication Tables (12 to 24)*\nTotal Questions: *13 Tables*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Tables', 13, 'tables') }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_squares', async (ctx) => {
  await ctx.editMessageText(
    '🔢 *Step 3: Squares (17² to 39²)*\nTotal Questions: *23 Squares*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Squares', 23, 'squares') }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_cubes', async (ctx) => {
  await ctx.editMessageText(
    '🧊 *Step 4: Cubes (11³ to 25³)*\nTotal Questions: *15 Cubes*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Cubes', 15, 'cubes') }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_powers', async (ctx) => {
  await ctx.editMessageText(
    '⚡ *Step 5: Powers (2–9)*\nTotal Questions: *38 Powers*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Powers', 38, 'powers') }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_factorials', async (ctx) => {
  await ctx.editMessageText(
    '❗ *Step 6: Factorials (1! to 8!)*\nTotal Questions: *8 Factorials*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Factorials', 8, 'factorials') }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_fractions', async (ctx) => {
  await ctx.editMessageText(
    '💯 *Step 7: Fractions ↔ Percentages*\nTotal Questions: *73 Values*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Fractions', 73, 'fractions') }
  );
  await ctx.answerCallbackQuery();
});

// Run Calculation Step Drills
bot.callbackQuery(/^run_calc_(.+)_([a-z0-9]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const match = ctx.match;
  const step = match[1];
  const mode = match[2] as 'all' | '10';

  let qs: TelegramQuizQuestion[] = [];
  let title = '';

  if (step === 'triplets') {
    qs = getTripletsStepDrill(mode);
    title = `📐 Step 1: Triplets (${mode === 'all' ? 'All 16' : '10 Qs'})`;
  } else if (step === 'tables') {
    qs = getTablesStepDrill(mode);
    title = `✖️ Step 2: Tables 12–24 (${mode === 'all' ? 'All 13' : '10 Qs'})`;
  } else if (step === 'squares') {
    qs = getSquaresStepDrill(mode);
    title = `🔢 Step 3: Squares 17–39 (${mode === 'all' ? 'All 23' : '10 Qs'})`;
  } else if (step === 'cubes') {
    qs = getCubesStepDrill(mode);
    title = `🧊 Step 4: Cubes 11–25 (${mode === 'all' ? 'All 15' : '10 Qs'})`;
  } else if (step === 'powers') {
    qs = getPowersStepDrill(mode);
    title = `⚡ Step 5: Powers 2–9 (${mode === 'all' ? 'All 38' : '10 Qs'})`;
  } else if (step === 'factorials') {
    qs = getFactorialsStepDrill(mode);
    title = `❗ Step 6: Factorials 1–8 (${mode === 'all' ? 'All 8' : '10 Qs'})`;
  } else if (step === 'fractions') {
    qs = getFractionsStepDrill(mode);
    title = `💯 Step 7: Fractions ↔ % (${mode === 'all' ? 'All 73' : '10 Qs'})`;
  }

  startQuizForUser(ctx.from.id, ctx.chat!.id, title, qs);
});

// Simplification Drills Catalog
bot.callbackQuery('speed_simp_menu', async (ctx) => {
  const cat = getSimplificationCatalog();
  const kb = new InlineKeyboard();

  for (const c of cat) {
    kb.text(c.title, `simp_cat_${c.difficulty.toLowerCase()}`).row();
  }
  kb.text('⬅️ Back to Speed Lab', 'nav_speed_lab');

  await ctx.editMessageText(
    '📐 *Simplification Drills*\nChoose difficulty level:',
    { parse_mode: 'Markdown', reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^simp_cat_([a-z]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const diffKey = ctx.match[1];
  const cat = getSimplificationCatalog();
  const chosen = cat.find((c) => c.difficulty.toLowerCase() === diffKey);
  if (!chosen) return;

  const kb = new InlineKeyboard();
  for (let i = 0; i < chosen.sets.length; i += 2) {
    const s1 = chosen.sets[i];
    const s2 = chosen.sets[i + 1];

    const act1 = registerAction({ type: 'start_simp_set', setId: s1.id, title: s1.title });
    kb.text(`${s1.title} (10 Qs)`, act1);

    if (s2) {
      const act2 = registerAction({ type: 'start_simp_set', setId: s2.id, title: s2.title });
      kb.text(`${s2.title} (10 Qs)`, act2);
    }
    kb.row();
  }
  kb.text('⬅️ Back to Difficulties', 'speed_simp_menu');

  await ctx.editMessageText(
    `📐 *${chosen.title}*\nSelect a set to practice:`,
    { parse_mode: 'Markdown', reply_markup: kb }
  );
});

bot.callbackQuery('speed_routine', async (ctx) => {
  await ctx.answerCallbackQuery();
  const qs = getDailyRoutineWorkout();
  startQuizForUser(ctx.from.id, ctx.chat!.id, '🏆 Daily 25-Question Routine Workout', qs);
});

bot.callbackQuery('speed_mixed', async (ctx) => {
  await ctx.answerCallbackQuery();
  startQuizForUser(ctx.from.id, ctx.chat!.id, '⚡ Mixed Speed Blitz', generateMixedSpeedDrill(10));
});

bot.callbackQuery('start_mock_err_reasoning', async (ctx) => {
  await ctx.answerCallbackQuery();
  const qs = loadMockErrorsForSubject('reasoning', undefined, 'all');
  startQuizForUser(ctx.from.id, ctx.chat!.id, '🧠 Reasoning Mock Errors (Full Set)', qs);
});

bot.callbackQuery('nav_help', async (ctx) => {
  const helpText =
    `💡 *CGL Bot Navigation Guide*\n\n` +
    `1. *Chapter Bank* — All chapters in Math, English, GK & Reasoning.\n` +
    `2. *Mock Errors* — Directly attempt questions you missed in mocks.\n` +
    `3. *Full Set vs Quick 10* — Whenever you choose a set, you can practice **ALL questions** in that set or do a quick 10!\n` +
    `4. Type /stop anytime to finish early and see your score.`;

  await ctx.editMessageText(helpText, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard().text('⬅️ Back to Main Menu', 'nav_root'),
  });
  await ctx.answerCallbackQuery();
});

// ----------------------------------------------------
// DYNAMIC ACTION DISPATCHER (Short Action IDs bypass 64-byte limit)
// ----------------------------------------------------

bot.on('callback_query:data', async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  const action = getAction(data);

  if (!action) {
    // If not a registered dynamic action, let other handlers process
    return next();
  }

  await ctx.answerCallbackQuery();

  // 1. English Section Clicked (Black Book or Ayush Vocab)
  if (action.type === 'eng_sec') {
    const sections = getEnglishCatalog();
    const sec = sections.find((s) => s.id === action.secId);
    if (!sec) return;

    const kb = new InlineKeyboard();
    for (const topic of sec.topics) {
      const actId = registerAction({ type: 'eng_topic', secId: sec.id, topicId: topic.id });
      kb.text(`${topic.title} (${topic.sets.length} Sets)`, actId).row();
    }
    kb.text('⬅️ Back to Books', 'cb_sub_english');

    await ctx.editMessageText(`📖 *${sec.title}:*\nChoose a vocabulary topic:`, {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });
    return;
  }

  // 2. English Topic Clicked (e.g. Synonyms, One Word Substitution)
  if (action.type === 'eng_topic') {
    const sections = getEnglishCatalog();
    const sec = sections.find((s) => s.id === action.secId);
    const topic = sec?.topics.find((t) => t.id === action.topicId);
    if (!topic) return;

    const kb = new InlineKeyboard();
    // 2 sets per row
    for (let i = 0; i < topic.sets.length; i += 2) {
      const s1 = topic.sets[i];
      const s2 = topic.sets[i + 1];

      const act1 = registerAction({ type: 'view_set', filePath: s1.filePath, title: s1.title, total: s1.totalQuestions });
      kb.text(`${s1.title} (${s1.totalQuestions} Qs)`, act1);

      if (s2) {
        const act2 = registerAction({ type: 'view_set', filePath: s2.filePath, title: s2.title, total: s2.totalQuestions });
        kb.text(`${s2.title} (${s2.totalQuestions} Qs)`, act2);
      }
      kb.row();
    }

    const backAct = registerAction({ type: 'eng_sec', secId: action.secId });
    kb.text('⬅️ Back to Topics', backAct);

    await ctx.editMessageText(`🔤 *${topic.title}* (${topic.sets.length} Sets Available):\nSelect a set to practice:`, {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });
    return;
  }

  // 3. Math Section Clicked (Top 500 or Pinnacle)
  if (action.type === 'math_sec') {
    const mathSections = getMathCatalog();
    const sec = mathSections.find((s) => s.id === action.secId);
    if (!sec) return;

    const kb = new InlineKeyboard();
    for (let i = 0; i < sec.topics.length; i += 2) {
      const t1 = sec.topics[i];
      const t2 = sec.topics[i + 1];

      const act1 = registerAction({ type: 'math_topic', secId: sec.id, topicId: t1.id });
      kb.text(t1.title, act1);

      if (t2) {
        const act2 = registerAction({ type: 'math_topic', secId: sec.id, topicId: t2.id });
        kb.text(t2.title, act2);
      }
      kb.row();
    }
    kb.text('⬅️ Back to Math Modules', 'cb_sub_math');

    await ctx.editMessageText(`📐 *${sec.title}:*\nChoose a chapter to drill:`, {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });
    return;
  }

  // 4. Math Topic Clicked (e.g. Percentage, Profit and Loss)
  if (action.type === 'math_topic') {
    const mathSections = getMathCatalog();
    const sec = mathSections.find((s) => s.id === action.secId);
    const topic = sec?.topics.find((t) => t.id === action.topicId);
    if (!topic) return;

    const kb = new InlineKeyboard();
    for (const s of topic.sets) {
      const act = registerAction({ type: 'view_set', filePath: s.filePath, title: s.title, total: s.totalQuestions });
      kb.text(`▶️ ${s.title} (${s.totalQuestions} Questions)`, act).row();
    }

    const backAct = registerAction({ type: 'math_sec', secId: action.secId });
    kb.text('⬅️ Back to Chapters', backAct);

    await ctx.editMessageText(`📊 *${topic.title}:*\nSelect set to practice:`, {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });
    return;
  }

  // 5. GA Topic Clicked (e.g. Polity, History)
  if (action.type === 'ga_topic') {
    const gaTopics = getGeneralAwarenessCatalog();
    const topic = gaTopics.find((t) => t.id === action.topicId);
    if (!topic) return;

    const kb = new InlineKeyboard();
    for (const s of topic.sets) {
      const act = registerAction({ type: 'view_set', filePath: s.filePath, title: s.title, total: s.totalQuestions });
      kb.text(`${s.title} (${s.totalQuestions} Qs)`, act).row();
    }
    kb.text('⬅️ Back to Subjects', 'cb_sub_ga');

    await ctx.editMessageText(`🏛️ *${topic.title}* (${topic.sets.length} Chapters):\nChoose a chapter to practice:`, {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });
    return;
  }

  // 6. View Set: Choose between "Practice All Questions" vs "Quick 10"
  if (action.type === 'view_set') {
    const actAll = registerAction({ type: 'start_set', filePath: action.filePath, title: action.title, mode: 'all' });
    const act10 = registerAction({ type: 'start_set', filePath: action.filePath, title: action.title, mode: '10' });

    const kb = new InlineKeyboard()
      .text(`🚀 Practice ALL (${action.total} Questions)`, actAll)
      .row()
      .text('⚡ Quick 10 Questions', act10)
      .row()
      .text('📁 Back to Chapter Bank', 'nav_chapter_bank');

    const msg =
      `📖 *${action.title}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Total Questions in Set:* ${action.total}\n\n` +
      `👉 *How would you like to practice?*`;

    await ctx.editMessageText(msg, {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });
    return;
  }

  // 7. Start Set: Execute All or Quick 10!
  if (action.type === 'start_set') {
    const qs = loadQuestionsFromSet(action.filePath, action.mode);
    const modeLabel = action.mode === 'all' ? `All ${qs.length} Questions` : 'Quick 10';
    startQuizForUser(ctx.from.id, ctx.chat!.id, `${action.title} (${modeLabel})`, qs);
    return;
  }

  // 8. Mock Errors Subject Selected
  if (action.type === 'mock_sub') {
    const catalog = getMockErrorsCatalog();
    const item = catalog.find((c) => c.subjectId === action.subId);
    if (!item) return;

    const kb = new InlineKeyboard();

    // Option to practice all mistakes in subject
    const actAllSubject = registerAction({ type: 'start_mock', subId: item.subjectId, mode: 'all' });
    const act10Subject = registerAction({ type: 'start_mock', subId: item.subjectId, mode: '10' });

    kb.text(`🔥 Practice ALL ${item.totalQuestions} Mistakes`, actAllSubject).row();
    kb.text(`⚡ Quick 10 Mistakes`, act10Subject).row();

    // List individual chapters if present
    for (const ch of item.chapters) {
      if (ch.count > 0) {
        const actCh = registerAction({ type: 'start_mock', subId: item.subjectId, chapterNum: ch.chapterNum, mode: 'all' });
        kb.text(`📁 ${ch.title} (${ch.count} Qs)`, actCh).row();
      }
    }

    kb.text('⬅️ Back to Mock Subjects', 'nav_mock_errors');

    const msg =
      `🎯 *${item.title}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Total Mistakes Logged: *${item.totalQuestions} Questions*\n\n` +
      `Select a practice option below:`;

    await ctx.editMessageText(msg, {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });
    return;
  }

  // 9. Start Mock Drill
  if (action.type === 'start_mock') {
    const qs = loadMockErrorsForSubject(action.subId, action.chapterNum, action.mode);
    const subTitle = action.subId.charAt(0).toUpperCase() + action.subId.slice(1).replace('_', ' ');
    const modeLabel = action.mode === 'all' ? `All ${qs.length} Questions` : 'Quick 10';
    startQuizForUser(ctx.from.id, ctx.chat!.id, `🎯 ${subTitle} Mistakes (${modeLabel})`, qs);
    return;
  }

  // 10. Start Simplification Set Drill
  if (action.type === 'start_simp_set') {
    const allSets = getSimplificationCatalog().flatMap((c) => c.sets);
    const target = allSets.find((s) => s.id === action.setId);
    if (!target) return;
    const questions = target.questions.map((q: any) =>
      sanitizeTelegramQuiz({
        id: q.id || `simp_${q.q_num}`,
        question: `📐 [${target.title}]\n${q.question}`,
        options: q.options,
        correctOption: q.answer || q.correctOption,
        solution: q.solution,
        subject: 'Simplification',
        topic: target.title,
        source: target.title,
      })
    );
    startQuizForUser(ctx.from.id, ctx.chat!.id, `📐 ${target.title} (All ${questions.length} Qs)`, questions);
    return;
  }
});

// ----------------------------------------------------
// POLL ANSWER EVENT LISTENER
// ----------------------------------------------------

bot.on('poll_answer', async (ctx) => {
  const answer = ctx.pollAnswer;
  const pollId = answer.poll_id;
  const session = getSessionByPollId(pollId);

  if (!session) return;

  const currentQ = session.questions[session.currentIndex];
  if (!currentQ) return;

  const chosenOptionIndex = answer.option_ids[0];
  if (chosenOptionIndex === currentQ.correctOptionIndex) {
    session.score++;
  }
  session.answeredCount++;

  session.currentIndex++;

  setTimeout(async () => {
    try {
      await sendCurrentQuestion(bot, session);
    } catch (err) {
      console.error('[TelegramBot] Error sending next question:', err);
    }
  }, 1200);
});

// ----------------------------------------------------
// LAUNCH BOT
// ----------------------------------------------------

export async function launchBot() {
  if (!token) {
    console.warn('[TelegramBot] Bot token missing, skipping startup.');
    return;
  }
  console.log('[TelegramBot] Starting full website-mirrored Telegram bot via Long Polling...');
  bot.catch((err) => {
    console.error('[TelegramBot] Error encountered:', err);
  });
  bot.start({
    onStart: (botInfo) => {
      console.log(`[TelegramBot] Connected! Bot is running as @${botInfo.username}`);
    },
  });
}

// Start polling ONLY if run directly via CLI (not when imported in Vercel serverless)
const isDirectRun = Boolean(process.argv[1]?.replace(/\\/g, '/').endsWith('src/telegram/bot.ts'));
if (isDirectRun && !process.env.VERCEL) {
  launchBot();
}
