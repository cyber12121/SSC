import { Chapter } from '../types';

export type GKSubjectId =
  | 'history'
  | 'polity'
  | 'geography'
  | 'economics'
  | 'science'
  | 'static_gk'
  | 'full_tests';

export interface GKSubTopic {
  key: string;
  label: string;
}

export interface GKSubjectConfig {
  id: GKSubjectId;
  title: string;
  shortTitle: string;
  iconName: 'Landmark' | 'Scale' | 'Globe2' | 'TrendingUp' | 'Atom' | 'Sparkles' | 'FileText';
  gradient: string;
  badge: string;
  bgLight: string;
  borderCol: string;
  textCol: string;
  desc: string;
  subTopics: GKSubTopic[];
}

export const GK_SUBJECT_CONFIGS: Record<GKSubjectId, GKSubjectConfig> = {
  history: {
    id: 'history',
    title: 'History',
    shortTitle: 'History',
    iconName: 'Landmark',
    gradient: 'from-amber-600 via-orange-600 to-red-600',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    bgLight: 'bg-amber-50/70',
    borderCol: 'border-amber-200 hover:border-amber-300',
    textCol: 'text-amber-700',
    desc: 'Ancient Indian History, Medieval Sultans & Mughals, and the Modern Freedom Struggle.',
    subTopics: [
      { key: 'all', label: 'All History' },
      { key: 'history_ancient', label: 'Ancient History' },
      { key: 'history_medieval', label: 'Medieval History' },
      { key: 'history_modern', label: 'Modern History' },
      { key: 'tests', label: 'History Tests' },
    ],
  },
  polity: {
    id: 'polity',
    title: 'Indian Polity & Constitution',
    shortTitle: 'Polity',
    iconName: 'Scale',
    gradient: 'from-blue-600 via-indigo-600 to-violet-600',
    badge: 'bg-blue-100 text-blue-900 border-blue-200',
    bgLight: 'bg-blue-50/70',
    borderCol: 'border-blue-200 hover:border-blue-300',
    textCol: 'text-blue-700',
    desc: 'Constituent Assembly, Preamble, Fundamental Rights, Parliament, Judiciary & Amendments.',
    subTopics: [
      { key: 'all', label: 'All Polity' },
      { key: 'polity', label: 'Core Polity Chapters' },
      { key: 'tests', label: 'Polity Tests' },
    ],
  },
  geography: {
    id: 'geography',
    title: 'Geography',
    shortTitle: 'Geography',
    iconName: 'Globe2',
    gradient: 'from-emerald-600 via-teal-600 to-cyan-700',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    bgLight: 'bg-emerald-50/70',
    borderCol: 'border-emerald-200 hover:border-emerald-300',
    textCol: 'text-emerald-700',
    desc: 'Indian River Systems, Physiography, Climate & Monsoons, Soils, and National Parks.',
    subTopics: [
      { key: 'all', label: 'All Geography' },
      { key: 'geography', label: 'Core Geography Chapters' },
      { key: 'tests', label: 'Geography Tests' },
    ],
  },
  economics: {
    id: 'economics',
    title: 'Economics',
    shortTitle: 'Economics',
    iconName: 'TrendingUp',
    gradient: 'from-cyan-600 via-sky-600 to-blue-700',
    badge: 'bg-cyan-100 text-cyan-900 border-cyan-200',
    bgLight: 'bg-cyan-50/70',
    borderCol: 'border-cyan-200 hover:border-cyan-300',
    textCol: 'text-cyan-700',
    desc: 'RBI & Monetary Policy, Union Budget, National Income, Inflation, and Govt Schemes.',
    subTopics: [
      { key: 'all', label: 'All Economics' },
      { key: 'economics', label: 'Core Economics Chapters' },
      { key: 'tests', label: 'Economics Tests' },
    ],
  },
  science: {
    id: 'science',
    title: 'General Science',
    shortTitle: 'Science',
    iconName: 'Atom',
    gradient: 'from-purple-600 via-violet-600 to-fuchsia-600',
    badge: 'bg-purple-100 text-purple-900 border-purple-200',
    bgLight: 'bg-purple-50/70',
    borderCol: 'border-purple-200 hover:border-purple-300',
    textCol: 'text-purple-700',
    desc: 'Physics (Mechanics, Optics, Electricity), Chemistry (Matter, Reactions), and Biology (Cell, Human Body).',
    subTopics: [
      { key: 'all', label: 'All Science' },
      { key: 'physics', label: 'Physics' },
      { key: 'chemistry', label: 'Chemistry' },
      { key: 'biology', label: 'Biology' },
      { key: 'tests', label: 'Science Tests' },
    ],
  },
  static_gk: {
    id: 'static_gk',
    title: 'Static GK & Culture',
    shortTitle: 'Static GK',
    iconName: 'Sparkles',
    gradient: 'from-rose-500 via-pink-600 to-fuchsia-600',
    badge: 'bg-rose-100 text-rose-900 border-rose-200',
    bgLight: 'bg-rose-50/70',
    borderCol: 'border-rose-200 hover:border-rose-300',
    textCol: 'text-rose-700',
    desc: 'Dances, Music & Instruments, Festivals, Census, Books & Authors, and Sports Honours.',
    subTopics: [
      { key: 'all', label: 'All Static GK' },
      { key: 'static_gk', label: 'Culture, Heritage & Awards' },
    ],
  },
  full_tests: {
    id: 'full_tests',
    title: 'Subject Full Tests',
    shortTitle: 'Full Tests',
    iconName: 'FileText',
    gradient: 'from-slate-700 via-indigo-800 to-slate-900',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-200',
    bgLight: 'bg-slate-50/70',
    borderCol: 'border-indigo-200 hover:border-indigo-300',
    textCol: 'text-indigo-700',
    desc: '25-question subject mock test papers across History, Polity, Geography, Science & Economics.',
    subTopics: [
      { key: 'all', label: 'All Full Tests' },
      { key: 'history', label: 'History Tests' },
      { key: 'polity', label: 'Polity Tests' },
      { key: 'geography', label: 'Geography Tests' },
      { key: 'science', label: 'Science Tests' },
      { key: 'economics', label: 'Economics Tests' },
    ],
  },
};

export const GK_SUBJECT_LIST: GKSubjectConfig[] = Object.values(GK_SUBJECT_CONFIGS);

export function getChapterGKSubject(chapter: Chapter): GKSubjectId {
  if (chapter.gk_subject && (chapter.gk_subject in GK_SUBJECT_CONFIGS)) {
    return chapter.gk_subject as GKSubjectId;
  }

  const topic = (chapter.topic_name || '').toLowerCase();
  const title = (chapter.chapter_title || '').toLowerCase();

  if (topic.includes('history') || title.includes('history')) return 'history';
  if (topic.includes('polity') || title.includes('polity') || title.includes('constitution')) return 'polity';
  if (topic.includes('geography') || title.includes('geography')) return 'geography';
  if (topic.includes('economics') || title.includes('economics')) return 'economics';
  if (
    topic.includes('physics') || topic.includes('chemistry') || topic.includes('biology') ||
    title.includes('physics') || title.includes('chemistry') || title.includes('biology')
  ) {
    return 'science';
  }
  if (topic.includes('static') || title.includes('dance') || title.includes('festival') || title.includes('music')) {
    return 'static_gk';
  }

  if (chapter.is_test || chapter.subject === 'GK Full Tests' || title.includes('test')) {
    return 'full_tests';
  }

  return 'static_gk';
}

export function getTopicGKSubject(topicName: string): GKSubjectId {
  const t = (topicName || '').toLowerCase();

  // History
  if (t.includes('history') || t.includes('vedic') || t.includes('harappan') || t.includes('sultanate') || t.includes('mughal') || t.includes('gandhian') || t.includes('revolt')) {
    return 'history';
  }

  // Polity
  if (t.includes('polity') || t.includes('constitution') || t.includes('parliament') || t.includes('judiciary') || t.includes('rights') || t.includes('executive') || t.includes('panchayat')) {
    return 'polity';
  }

  // Geography
  if (t.includes('geography') || t.includes('drainage') || t.includes('river') || t.includes('physiography') || t.includes('climate') || t.includes('soil') || t.includes('park') || t.includes('environment')) {
    return 'geography';
  }

  // Economics
  if (t.includes('economic') || t.includes('banking') || t.includes('monetary') || t.includes('fiscal') || t.includes('budget') || t.includes('scheme') || t.includes('market') || t.includes('gdp')) {
    return 'economics';
  }

  // Science
  if (t.includes('biology') || t.includes('chemistry') || t.includes('physics') || t.includes('science') || t.includes('disease') || t.includes('acid') || t.includes('motion')) {
    return 'science';
  }

  // Static GK
  return 'static_gk';
}

export function formatGKSubTopicTitle(topic: string): string {
  if (!topic) return 'Chapter';
  const clean = topic.replace(/_/g, ' ');
  if (clean === 'history ancient') return 'Ancient History';
  if (clean === 'history medieval') return 'Medieval History';
  if (clean === 'history modern') return 'Modern History';
  if (clean === 'static gk') return 'Static GK';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}
