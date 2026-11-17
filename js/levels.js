// Continuous left-to-right sidescrolling book world (X: 0 -> 400)
// 4 long middle-school subject chapters with steeper difficulty curve

export const WORLD_DATA = {
  spawn: { x: 2, y: -2.2 },
  goal: { x: 400.0, y: 2.8 },
  sections: [
    { startX: -14, endX: 100, theme: 'svenska', name: '1. Svenska (Uppvärmning+)' },
    { startX: 100, endX: 200, theme: 'matte', name: '2. Matematik (Utmanande)' },
    { startX: 200, endX: 300, theme: 'no', name: '3. NO & Labb (Svår)' },
    { startX: 300, endX: 416, theme: 'slojd', name: '4. Slöjd & Bild (Mycket svår!)' },
  ],
  checkpoints: [
    { x: 100.0, y: -1.6 },
    { x: 200.0, y: -1.8 },
    { x: 300.0, y: -1.4 },
  ],
  signs: [
    {
      x: 8.0,
      y: -1.1,
      text: 'HOPPA!',
      subtext: '[SPACE / W]',
      arrowTo: { x: 10.6, y: -2.0 },
      curve: -12,
      tilt: -0.05,
    },
    {
      x: 21.8,
      y: -1.1,
      text: 'AKTA!',
      subtext: 'BLÄCKTAGGAR',
      arrowTo: { x: 22.1, y: -2.7 },
      curve: 10,
      tilt: 0.04,
    },
    {
      x: 25.4,
      y: -0.8,
      text: 'STUDSA!',
      subtext: 'SUDDGUMMI',
      arrowTo: { x: 25.4, y: -2.3 },
      curve: -8,
      tilt: -0.03,
    },
    {
      x: 34.4,
      y: 2.65,
      text: 'DASH [SHIFT]',
      subtext: 'ÖVER GAPET',
      arrowTo: { x: 37.2, y: 1.0 },
      curve: -14,
      tilt: 0.02,
    },
    {
      x: 102.0,
      y: 1.7,
      text: 'KAPITEL 2: MATEMATIK',
      subtext: 'LINJALER & VÄGGHOPP',
      tilt: -0.02,
    },
    {
      x: 202.0,
      y: 1.7,
      text: 'KAPITEL 3: NO & LABB',
      subtext: 'HALA GLASBLOCK & LABBFJÄDRAR',
      tilt: 0.02,
    },
    {
      x: 302.0,
      y: 1.9,
      text: 'KAPITEL 4: SLÖJD & BILD',
      subtext: 'FINAL — SKÖRA BLOCK & PRECISION!',
      tilt: -0.02,
    },
  ],
  platforms: [
    // =========================================================
    // KAPITEL 1: SVENSKA — Aningen svårare från start (X: 0 -> 100)
    // =========================================================
    { x: 4.2, y: -3.8, w: 8.2, h: 0.95, style: 'bookblock' },
    { x: 11.8, y: -2.5, w: 2.8, h: 0.55, style: 'postit-yellow', tilt: -0.03 },
    { x: 16.8, y: -1.1, w: 2.6, h: 0.55, style: 'postit-pink', tilt: 0.03 },
    { x: 22.8, y: -3.6, w: 6.2, h: 0.85, style: 'bookblock' },
    { x: 24.8, y: -2.9, w: 1.7, h: 0.65, style: 'eraser', bounce: 20.5 },
    { x: 30.8, y: 1.3, w: 4.6, h: 0.75, style: 'bookblock' },
    // Bonus star route
    { x: 36.4, y: 3.0, w: 2.1, h: 0.5, style: 'postit-pink', tilt: 0.04 },
    { x: 41.8, y: 3.9, w: 2.0, h: 0.5, style: 'postit-yellow', tilt: -0.03 },
    // Main route
    { x: 37.8, y: -0.4, w: 2.7, h: 0.55, style: 'postit-mint', tilt: -0.04 },
    { x: 43.0, y: -1.8, w: 2.6, h: 0.55, style: 'postit-yellow' },
    // Extended Section 1: book-tower wall-jump + 2-eraser hop
    { x: 49.0, y: -3.0, w: 4.6, h: 0.85, style: 'bookblock' },
    { x: 50.8, y: -2.3, w: 1.7, h: 0.65, style: 'eraser', bounce: 20.5 },
    { x: 55.8, y: 0.8, w: 0.9, h: 5.4, style: 'bookblock' },
    { x: 60.6, y: 2.2, w: 3.4, h: 0.7, style: 'bookblock' },
    {
      x: 67.4,
      y: 0.8,
      w: 2.6,
      h: 0.55,
      style: 'postit-pink',
      move: { axis: 'x', range: 1.8, speed: 1.45 },
    },
    { x: 74.0, y: -2.6, w: 1.7, h: 0.65, style: 'eraser', bounce: 20.0 },
    { x: 79.2, y: -1.2, w: 1.7, h: 0.65, style: 'eraser', bounce: 21.0 },
    { x: 84.8, y: 1.4, w: 2.8, h: 0.65, style: 'bookblock' },
    { x: 91.6, y: -0.6, w: 2.5, h: 0.55, style: 'postit-mint', tilt: 0.03 },
    // Checkpoint 1 platform
    { x: 100.2, y: -2.6, w: 5.2, h: 0.9, style: 'bookblock' },

    // =========================================================
    // KAPITEL 2: MATEMATIK — Utmanande (X: 100 -> 200)
    // =========================================================
    {
      x: 107.2,
      y: -1.8,
      w: 2.8,
      h: 0.55,
      style: 'ruler',
      move: { axis: 'x', range: 2.1, speed: 1.75 },
    },
    {
      x: 114.6,
      y: -0.6,
      w: 2.6,
      h: 0.6,
      style: 'setsquare',
      move: { axis: 'x', range: 2.1, speed: 1.9 },
    },
    { x: 121.4, y: -3.2, w: 1.75, h: 0.65, style: 'eraser', bounce: 21.5 },
    { x: 126.0, y: 0.2, w: 0.9, h: 7.2, style: 'mathblock' },
    { x: 129.2, y: 1.4, w: 0.9, h: 7.2, style: 'mathblock' },
    { x: 134.4, y: 2.8, w: 3.6, h: 0.7, style: 'setsquare' },
    {
      x: 141.6,
      y: -0.4,
      w: 2.5,
      h: 0.55,
      style: 'ruler',
      move: { axis: 'y', range: 2.3, speed: 1.95 },
    },
    { x: 148.0, y: 1.0, w: 2.4, h: 0.6, style: 'mathblock' },
    // Second math gauntlet: narrow set-squares + 3-eraser chain
    { x: 154.2, y: -0.8, w: 2.2, h: 0.55, style: 'setsquare', tilt: -0.04 },
    {
      x: 160.4,
      y: -1.8,
      w: 2.4,
      h: 0.55,
      style: 'ruler',
      move: { axis: 'x', range: 2.2, speed: 2.0 },
    },
    { x: 167.2, y: -3.2, w: 1.7, h: 0.65, style: 'eraser', bounce: 20.5 },
    { x: 172.6, y: -1.8, w: 1.7, h: 0.65, style: 'eraser', bounce: 21.0 },
    { x: 178.0, y: -0.4, w: 1.7, h: 0.65, style: 'eraser', bounce: 21.5 },
    { x: 183.6, y: 2.0, w: 2.2, h: 0.6, style: 'setsquare' },
    { x: 190.4, y: 0.2, w: 0.9, h: 5.4, style: 'mathblock' },
    { x: 194.8, y: -1.2, w: 2.2, h: 0.6, style: 'mathblock' },
    // Checkpoint 2 platform
    { x: 200.2, y: -2.8, w: 5.0, h: 0.9, style: 'mathblock' },

    // =========================================================
    // KAPITEL 3: NO & LABB — Svår (X: 200 -> 300)
    // =========================================================
    { x: 206.8, y: -1.6, w: 2.4, h: 0.55, style: 'iceblock', slippery: true },
    { x: 212.6, y: -0.4, w: 2.2, h: 0.55, style: 'iceblock', slippery: true },
    {
      x: 219.2,
      y: 0.4,
      w: 2.4,
      h: 0.55,
      style: 'corkblock',
      move: { axis: 'x', range: 2.4, speed: 2.15 },
    },
    { x: 226.4, y: -3.0, w: 1.65, h: 0.65, style: 'springpad', bounce: 22.5 },
    { x: 231.6, y: 1.6, w: 2.2, h: 0.55, style: 'iceblock', slippery: true },
    { x: 236.8, y: 2.0, w: 0.85, h: 5.4, style: 'corkblock' },
    { x: 242.2, y: 0.4, w: 2.1, h: 0.55, style: 'iceblock', slippery: true },
    {
      x: 248.2,
      y: -0.6,
      w: 2.1,
      h: 0.55,
      style: 'corkblock',
      move: { axis: 'y', range: 2.4, speed: 2.3 },
    },
    // Long slippery ice-run + springpad bounces over acid/ink pit
    { x: 254.6, y: 1.6, w: 2.8, h: 0.55, style: 'iceblock', slippery: true },
    { x: 260.8, y: 0.6, w: 2.2, h: 0.55, style: 'iceblock', slippery: true },
    { x: 266.8, y: -2.8, w: 1.6, h: 0.65, style: 'springpad', bounce: 21.5 },
    { x: 272.2, y: -1.4, w: 1.6, h: 0.65, style: 'springpad', bounce: 22.0 },
    { x: 277.8, y: 1.2, w: 2.0, h: 0.55, style: 'iceblock', slippery: true },
    {
      x: 284.2,
      y: 0.2,
      w: 2.1,
      h: 0.55,
      style: 'corkblock',
      move: { axis: 'x', range: 2.3, speed: 2.35 },
    },
    { x: 291.2, y: -1.8, w: 1.6, h: 0.65, style: 'springpad', bounce: 21.5 },
    { x: 295.8, y: 0.8, w: 2.0, h: 0.55, style: 'corkblock' },
    // Checkpoint 3 platform
    { x: 300.2, y: -2.4, w: 4.8, h: 0.85, style: 'corkblock' },

    // =========================================================
    // KAPITEL 4: SLÖJD & BILD — Väldigt svår Final! (X: 300 -> 400)
    // =========================================================
    {
      x: 306.4,
      y: -0.6,
      w: 2.0,
      h: 0.55,
      style: 'woodblock',
      move: { axis: 'y', range: 2.3, speed: 2.45 },
    },
    { x: 312.2, y: 1.4, w: 0.8, h: 5.6, style: 'woodblock' },
    { x: 316.0, y: 2.4, w: 0.8, h: 5.6, style: 'woodblock' },
    // Rapid crumble-paper chain!
    { x: 321.4, y: 0.8, w: 1.9, h: 0.5, style: 'crumble', crumble: true },
    { x: 327.2, y: 1.6, w: 1.9, h: 0.5, style: 'crumble', crumble: true },
    { x: 333.0, y: 0.4, w: 1.9, h: 0.5, style: 'crumble', crumble: true },
    // 4-bounce high-speed rhythm chain over giant spike pit
    { x: 338.8, y: -2.8, w: 1.5, h: 0.6, style: 'eraser', bounce: 20.5 },
    { x: 344.2, y: -1.8, w: 1.5, h: 0.6, style: 'springpad', bounce: 21.5 },
    { x: 349.6, y: -1.0, w: 1.5, h: 0.6, style: 'eraser', bounce: 22.0 },
    { x: 355.2, y: -0.2, w: 1.5, h: 0.6, style: 'springpad', bounce: 22.8 },
    // Fast moving wood plank + crumble + double wall-climb to Goal!
    {
      x: 363.0,
      y: 1.6,
      w: 2.0,
      h: 0.55,
      style: 'woodblock',
      move: { axis: 'x', range: 2.5, speed: 2.6 },
    },
    { x: 370.8, y: 2.0, w: 1.8, h: 0.5, style: 'crumble', crumble: true },
    { x: 376.6, y: 0.4, w: 0.8, h: 5.4, style: 'woodblock' },
    { x: 380.4, y: 1.8, w: 0.8, h: 5.4, style: 'woodblock' },
    { x: 385.8, y: 2.6, w: 1.75, h: 0.5, style: 'crumble', crumble: true },
    {
      x: 392.2,
      y: 1.4,
      w: 1.9,
      h: 0.55,
      style: 'woodblock',
      move: { axis: 'y', range: 2.0, speed: 2.65 },
    },
    // Final goal platform!
    { x: 399.6, y: 1.7, w: 4.8, h: 0.85, style: 'woodblock' },
  ],
  hazards: [
    // Kapitel 1
    { x: 21.8, y: -3.15, w: 1.8, h: 0.25 },
    { x: 48.0, y: -2.55, w: 1.5, h: 0.25 },
    { x: 76.6, y: -4.6, w: 7.4, h: 0.25 },
    // Kapitel 2
    { x: 121.4, y: -4.6, w: 5.4, h: 0.25 },
    { x: 127.6, y: -3.4, w: 2.1, h: 0.25 },
    { x: 172.6, y: -4.8, w: 13.0, h: 0.25 },
    // Kapitel 3
    { x: 226.4, y: -4.6, w: 6.4, h: 0.25 },
    { x: 248.2, y: -4.6, w: 6.8, h: 0.25 },
    { x: 269.5, y: -4.6, w: 8.6, h: 0.25 },
    { x: 291.2, y: -4.6, w: 5.2, h: 0.25 },
    // Kapitel 4
    { x: 327.2, y: -4.6, w: 14.0, h: 0.25 },
    { x: 347.0, y: -4.6, w: 19.0, h: 0.25 },
    { x: 378.5, y: -4.6, w: 17.0, h: 0.25 },
  ],
  stars: [
    // Kapitel 1 (6 stars)
    { x: 16.8, y: 0.1 },
    { x: 30.8, y: 2.5 },
    { x: 41.8, y: 5.0 },
    { x: 55.8, y: 4.2 },
    { x: 67.4, y: 2.4 },
    { x: 84.8, y: 2.8 },
    // Kapitel 2 (6 stars)
    { x: 114.6, y: 1.0 },
    { x: 127.6, y: 0.8 },
    { x: 134.4, y: 4.1 },
    { x: 141.6, y: 2.8 },
    { x: 160.4, y: -0.2 },
    { x: 183.6, y: 3.4 },
    // Kapitel 3 (6 stars)
    { x: 212.6, y: 1.0 },
    { x: 231.6, y: 3.0 },
    { x: 236.8, y: 5.4 },
    { x: 254.6, y: 3.0 },
    { x: 269.5, y: 3.0 },
    { x: 284.2, y: 1.8 },
    // Kapitel 4 (6 stars)
    { x: 314.1, y: 2.6 },
    { x: 327.2, y: 3.0 },
    { x: 346.9, y: 3.0 },
    { x: 363.0, y: 3.2 },
    { x: 378.5, y: 2.8 },
    { x: 392.2, y: 4.2 },
  ],
};
