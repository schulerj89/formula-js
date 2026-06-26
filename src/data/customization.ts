export interface PaintOption {
  id: string;
  label: string;
  value: number;
  css: string;
}

export const bodyPaintOptions: PaintOption[] = [
  { id: 'scarlet', label: 'Scarlet', value: 0xe53935, css: '#e53935' },
  { id: 'azure', label: 'Azure', value: 0x2f80ed, css: '#2f80ed' },
  { id: 'emerald', label: 'Emerald', value: 0x00a676, css: '#00a676' },
  { id: 'solar', label: 'Solar', value: 0xffc857, css: '#ffc857' },
  { id: 'violet', label: 'Violet', value: 0x6c63ff, css: '#6c63ff' },
];

export const helmetPaintOptions: PaintOption[] = [
  { id: 'ivory', label: 'Ivory', value: 0xfff8e1, css: '#fff8e1' },
  { id: 'graphite', label: 'Graphite', value: 0x101820, css: '#101820' },
  { id: 'silver', label: 'Silver', value: 0xdde5ed, css: '#dde5ed' },
  { id: 'gold', label: 'Gold', value: 0xf4d35e, css: '#f4d35e' },
  { id: 'ruby', label: 'Ruby', value: 0xf45b69, css: '#f45b69' },
];

export const findPaint = (options: PaintOption[], id: string | null, fallback: PaintOption): PaintOption =>
  options.find((option) => option.id === id) ?? fallback;
