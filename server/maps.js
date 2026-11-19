// World is 1000 x 650 units. Falling below y=800 or leaving x in [-250,1250] = knocked out.
// Shape kinds: normal | bouncy | death | ice
// rect: centre x,y, width w, height h, angle (radians), optional move {dx,dy,period}
// circle: centre x,y, radius r
const MAPS = [
  {
    id: 'summit', name: 'Summit Hall', bg: '#20304a',
    spawns: [[300, 380], [700, 380], [400, 380], [600, 380], [500, 380], [250, 200], [750, 200], [500, 150]],
    shapes: [
      { type: 'rect', x: 500, y: 470, w: 600, h: 30, kind: 'normal' },
      { type: 'rect', x: 200, y: 290, w: 180, h: 18, kind: 'normal' },
      { type: 'rect', x: 800, y: 290, w: 180, h: 18, kind: 'normal' },
      { type: 'rect', x: 500, y: 200, w: 120, h: 16, kind: 'bouncy' },
    ],
  },
  {
    id: 'table', name: 'Round Table', bg: '#2a2340',
    spawns: [[320, 400], [680, 400], [260, 400], [740, 400], [380, 400], [620, 400], [150, 180], [850, 180]],
    shapes: [
      { type: 'rect', x: 500, y: 470, w: 600, h: 26, kind: 'normal' },
      { type: 'circle', x: 500, y: 470, r: 70, kind: 'bouncy' },
      { type: 'circle', x: 150, y: 260, r: 40, kind: 'bouncy' },
      { type: 'circle', x: 850, y: 260, r: 40, kind: 'bouncy' },
    ],
  },
  {
    id: 'curtain', name: 'Iron Curtain', bg: '#2b2b2b',
    spawns: [[220, 380], [780, 380], [300, 380], [700, 380], [150, 380], [850, 380], [380, 380], [620, 380]],
    shapes: [
      { type: 'rect', x: 250, y: 450, w: 380, h: 30, kind: 'normal' },
      { type: 'rect', x: 750, y: 450, w: 380, h: 30, kind: 'normal' },
      { type: 'rect', x: 500, y: 330, w: 14, h: 200, kind: 'death' },
      { type: 'rect', x: 500, y: 140, w: 220, h: 16, kind: 'normal' },
      { type: 'rect', x: 500, y: 560, w: 160, h: 16, kind: 'bouncy' },
    ],
  },
  {
    id: 'bouncy', name: 'Bouncy Castle', bg: '#3a1f3f',
    spawns: [[300, 300], [700, 300], [500, 250], [400, 300], [600, 300], [200, 200], [800, 200], [500, 120]],
    shapes: [
      { type: 'rect', x: 500, y: 480, w: 520, h: 26, kind: 'bouncy' },
      { type: 'rect', x: 180, y: 380, w: 140, h: 20, angle: 0.35, kind: 'normal' },
      { type: 'rect', x: 820, y: 380, w: 140, h: 20, angle: -0.35, kind: 'normal' },
      { type: 'circle', x: 500, y: 330, r: 34, kind: 'normal' },
      { type: 'rect', x: 500, y: 620, w: 700, h: 14, kind: 'death' },
    ],
  },
  {
    id: 'moving', name: 'Moving Day', bg: '#1d3b36',
    spawns: [[200, 300], [800, 300], [500, 200], [300, 300], [700, 300], [150, 300], [850, 300], [500, 120]],
    shapes: [
      { type: 'rect', x: 200, y: 400, w: 220, h: 22, kind: 'normal', move: { dx: 0, dy: 90, period: 5 } },
      { type: 'rect', x: 800, y: 400, w: 220, h: 22, kind: 'normal', move: { dx: 0, dy: -90, period: 5 } },
      { type: 'rect', x: 500, y: 300, w: 160, h: 20, kind: 'normal', move: { dx: 200, dy: 0, period: 6 } },
      { type: 'rect', x: 500, y: 540, w: 200, h: 20, kind: 'ice' },
    ],
  },
  {
    id: 'valley', name: 'The Valley', bg: '#2e3a1f',
    spawns: [[250, 200], [750, 200], [500, 350], [350, 250], [650, 250], [150, 150], [850, 150], [500, 150]],
    shapes: [
      { type: 'rect', x: 330, y: 420, w: 380, h: 24, angle: 0.4, kind: 'normal' },
      { type: 'rect', x: 670, y: 420, w: 380, h: 24, angle: -0.4, kind: 'normal' },
      { type: 'circle', x: 500, y: 498, r: 36, kind: 'bouncy' },
    ],
  },
  {
    id: 'rink', name: 'Ice Rink', bg: '#1d3550',
    spawns: [[300, 380], [700, 380], [500, 380], [400, 380], [600, 380], [250, 380], [750, 380], [500, 250]],
    shapes: [
      { type: 'rect', x: 500, y: 460, w: 580, h: 28, kind: 'ice' },
      { type: 'rect', x: 500, y: 300, w: 100, h: 16, kind: 'normal' },
      { type: 'circle', x: 210, y: 460, r: 20, kind: 'bouncy' },
      { type: 'circle', x: 790, y: 460, r: 20, kind: 'bouncy' },
    ],
  },
];

module.exports = { MAPS };
