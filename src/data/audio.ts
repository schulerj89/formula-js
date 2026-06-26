export type MusicCueId = 'menu' | 'prerace' | 'podium' | 'finale';

export interface MusicTheme {
  id: MusicCueId;
  title: string;
  bpm: number;
  rootHz: number;
  chordOffsets: number[];
  leadOffsets: number[];
  bassPattern: number[];
  gain: number;
}

export const musicThemes: Record<MusicCueId, MusicTheme> = {
  menu: {
    id: 'menu',
    title: 'Gridline Spark',
    bpm: 118,
    rootHz: 196,
    chordOffsets: [0, 7, 9, 5],
    leadOffsets: [12, 14, 16, 19, 16, 14, 12, 9],
    bassPattern: [0, 0, 7, 0, 9, 9, 5, 7],
    gain: 0.038,
  },
  prerace: {
    id: 'prerace',
    title: 'Five Lights Rising',
    bpm: 104,
    rootHz: 164.81,
    chordOffsets: [0, 3, 7, 10],
    leadOffsets: [12, 15, 17, 19, 22, 19, 17, 15],
    bassPattern: [0, 0, 3, 0, 7, 7, 10, 7],
    gain: 0.032,
  },
  podium: {
    id: 'podium',
    title: 'Carbon Champagne',
    bpm: 126,
    rootHz: 220,
    chordOffsets: [0, 5, 9, 7],
    leadOffsets: [12, 16, 19, 21, 24, 21, 19, 16],
    bassPattern: [0, 5, 0, 7, 9, 7, 5, 7],
    gain: 0.042,
  },
  finale: {
    id: 'finale',
    title: 'Apex Parade',
    bpm: 132,
    rootHz: 246.94,
    chordOffsets: [0, 7, 11, 5],
    leadOffsets: [12, 19, 23, 26, 28, 26, 23, 19],
    bassPattern: [0, 0, 7, 11, 5, 5, 7, 11],
    gain: 0.05,
  },
};

export const announcerVoiceProfiles = {
  'Arthur Bell': {
    accent: 'British RP',
    rate: 0.94,
    pitch: 0.82,
  },
  'Mags Whitlow': {
    accent: 'British Midlands',
    rate: 1.02,
    pitch: 1.08,
  },
  Radio: {
    accent: 'compressed pit wall radio operator',
    rate: 1.12,
    pitch: 0.64,
  },
} as const;
