import type { TrackDefinition } from '../types';

export const tracks: TrackDefinition[] = [
  {
    id: 'silverpine',
    name: 'Silverpine Switchback',
    country: 'United Kingdom',
    lengthKm: 4.8,
    laps: 3,
    difficulty: 2,
    scenery: 'forest',
    palette: { ground: 0x315b46, road: 0x20252b, accent: 0xf2f7f2, sky: 0x9fd4ff },
    points: [[0, -118], [68, -106], [118, -58], [98, 12], [132, 78], [46, 122], [-38, 98], [-118, 56], [-92, -8], [-138, -70], [-70, -126]],
    kerbZones: [[0.07, 0.16], [0.28, 0.36], [0.51, 0.59], [0.72, 0.81]],
    landmarks: [
      { label: 'Pine grandstand', at: 0.12, kind: 'grandstand' },
      { label: 'Stone bridge', at: 0.43, kind: 'bridge' },
      { label: 'Broadcast tower', at: 0.76, kind: 'tower' },
    ],
  },
  {
    id: 'marina',
    name: 'Marina Vista Circuit',
    country: 'Monaco',
    lengthKm: 3.9,
    laps: 4,
    difficulty: 3,
    scenery: 'harbor',
    palette: { ground: 0x4aa3a2, road: 0x23262d, accent: 0xfff0c2, sky: 0xbce8ff },
    points: [[0, -108], [54, -118], [112, -86], [104, -28], [146, 18], [112, 74], [38, 88], [-18, 130], [-84, 92], [-128, 18], [-86, -30], [-116, -86], [-44, -126]],
    kerbZones: [[0.1, 0.22], [0.35, 0.46], [0.59, 0.7], [0.82, 0.92]],
    landmarks: [
      { label: 'Harbor tunnel', at: 0.31, kind: 'tunnel' },
      { label: 'Yacht bridge', at: 0.57, kind: 'bridge' },
      { label: 'Sea wall stand', at: 0.88, kind: 'grandstand' },
    ],
  },
  {
    id: 'neon',
    name: 'Neon Borough GP',
    country: 'Japan',
    lengthKm: 5.2,
    laps: 3,
    difficulty: 4,
    scenery: 'city',
    palette: { ground: 0x26313f, road: 0x181c22, accent: 0xff4fd8, sky: 0x7bc7ff },
    points: [[0, -132], [92, -126], [132, -82], [92, -34], [142, 22], [108, 86], [24, 76], [-18, 132], [-88, 112], [-132, 42], [-82, -18], [-128, -76], [-56, -118]],
    kerbZones: [[0.05, 0.11], [0.25, 0.38], [0.49, 0.55], [0.69, 0.78], [0.87, 0.94]],
    landmarks: [
      { label: 'Metro flyover', at: 0.19, kind: 'bridge' },
      { label: 'Neon tower', at: 0.48, kind: 'tower' },
      { label: 'Downtown stand', at: 0.71, kind: 'grandstand' },
    ],
  },
  {
    id: 'valkyrie',
    name: 'Valkyrie Ridge',
    country: 'Norway',
    lengthKm: 6.1,
    laps: 2,
    difficulty: 5,
    scenery: 'alpine',
    palette: { ground: 0x52645a, road: 0x1e2529, accent: 0xf8fbff, sky: 0xc9e6ff },
    points: [[0, -142], [74, -126], [132, -66], [82, -8], [142, 52], [84, 124], [14, 104], [-50, 144], [-128, 92], [-106, 22], [-152, -40], [-88, -88], [-52, -134]],
    kerbZones: [[0.09, 0.18], [0.29, 0.39], [0.46, 0.54], [0.63, 0.74], [0.83, 0.91]],
    landmarks: [
      { label: 'Ridge tunnel', at: 0.36, kind: 'tunnel' },
      { label: 'Ski jump bridge', at: 0.62, kind: 'bridge' },
      { label: 'Summit tower', at: 0.84, kind: 'tower' },
    ],
  },
];

export const getTrack = (id: string): TrackDefinition => tracks.find((track) => track.id === id) ?? tracks[0];
