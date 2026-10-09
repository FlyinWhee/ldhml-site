// Themes for the sub-leagues. A theme is a set of CSS tokens on :root[data-league="<theme>"].
// The default theme is the first block of site/style.css (used by the LDHML home page).
// build.mjs turns this table into CSS: a light block, a dark block for the system setting,
// and a dark block for the manual toggle.
//   light / dark : token overrides ("--" is added for you)
//   mark         : colours of the ball icon in the header [ball, highlight]
//   brand        : CSS gradient for the league name in the header
//   decor        : extra CSS for the page, with {T} for the theme selector
export const THEMES = {
  retro: {
    // Same family as the league logo (indigo, magenta, a touch of gold), but calm: dusty tones, a very faint floor, no loud gradient.
    mark: ['#FF5B14', '#FFB48A'],
    brand: 'linear-gradient(180deg, #E9DFB4 8%, #D79BC0 92%)',
    light: {
      bg: '#F0EFF5', ink: '#1B1A2E', muted: '#5E5C72', line: '#DEDCE8', hover: '#F5F4F9',
      panel: '#1C1A33', 'panel-2': '#25223F', 'panel-line': '#3A3760', 'panel-ink': '#F3F2F8', 'panel-mute': '#A9A7C4',
      'led-off': '#2A2745', ball: '#B65A92', 'on-ball': '#FFFFFF', 'accent-text': '#8F2F6B', focus: '#A33F7C',
      blue: '#5A55B5', red: '#B65A92', 'stripe-a': '#5A55B5', 'stripe-b': '#B65A92', 'stripe-c': '#C9B263',
      shadow: '0 10px 28px rgba(28, 26, 51, .22)'
    },
    dark: {
      bg: '#0E0D1A', surface: '#17162A', ink: '#E9E8F2', muted: '#A3A1BD', line: '#2B2947', hover: '#1D1C33',
      panel: '#12112A', 'panel-2': '#1B1A38', 'panel-line': '#34325B', 'accent-text': '#E69BC8', focus: '#E69BC8',
      blue: '#9591E0', red: '#D98AB8', shadow: '0 10px 28px rgba(0, 0, 0, .55)'
    },
    decor: `
{T} .arena > .wrap { position: relative; z-index: 1; }
{T} .arena::after { content: ""; position: absolute; inset: auto 0 0 0; height: 45%; pointer-events: none;
  background: repeating-linear-gradient(90deg, rgba(182, 90, 146, .06) 0 1px, transparent 1px 84px), repeating-linear-gradient(0deg, rgba(182, 90, 146, .06) 0 1px, transparent 1px 34px);
  -webkit-mask-image: linear-gradient(transparent, #000); mask-image: linear-gradient(transparent, #000); }`
  },

  vintage: {
    // Old hockey programme, from the logo: faded paper, navy and tan. Only the league name keeps the serif face.
    mark: ['#C79A5E', '#F2DDB8'],
    brand: 'linear-gradient(180deg, #EBCB98 10%, #C79A5E 90%)',
    brandFont: "'Playfair Display', 'Georgia', 'Times New Roman', serif",
    light: {
      bg: '#F2F0EA', surface: '#FFFFFF', ink: '#1F2933', muted: '#5F6B76', line: '#DDD9CE', hover: '#F7F5F0',
      panel: '#1B2535', 'panel-2': '#263347', 'panel-line': '#3A4A62', 'panel-ink': '#F4F2EC', 'panel-mute': '#A9B4C2',
      'led-on': '#DDB074', 'led-off': '#2B3A4E', ball: '#C79A5E', 'on-ball': '#1B1206', 'accent-text': '#855A22', focus: '#9A6A2A',
      blue: '#2F4B73', red: '#A4443A', good: '#2F6B3A', bad: '#A4443A',
      'stripe-a': '#C79A5E', 'stripe-b': '#F2E6CC', 'stripe-c': '#C79A5E',
      shadow: '0 10px 28px rgba(30, 42, 58, .22)'
    },
    dark: {
      bg: '#0F1620', surface: '#17212D', ink: '#ECEAE3', muted: '#A2AEBB', line: '#273444', hover: '#1C2735',
      panel: '#0B111A', 'panel-2': '#131C28', 'panel-line': '#2D3C50', 'accent-text': '#E2B87C', focus: '#E2B87C',
      blue: '#8FB0DC', red: '#E58A80', good: '#7BBF88', bad: '#E58A80', shadow: '0 10px 28px rgba(0, 0, 0, .55)'
    },
    decor: `
{T} .brand b { font-size: 25px; }`
  },

  draft: {
    // Draft: black, silver and the gold of the logo.
    mark: ['#F7A71B', '#FFE3A3'],
    brand: 'linear-gradient(180deg, #FFD36B 8%, #F7A71B 92%)',
    light: {
      bg: '#F1EFEA', ink: '#17140D', muted: '#6A6354', line: '#E0DACB', hover: '#F7F5F0',
      panel: '#141415', 'panel-2': '#202022', 'panel-line': '#3A3A3E', 'panel-ink': '#FFFFFF', 'panel-mute': '#B3B1AA',
      'led-on': '#F7A71B', 'led-off': '#2B2B2E', ball: '#F7A71B', 'on-ball': '#1A1100', 'accent-text': '#8F5A00', focus: '#B87400',
      blue: '#3A3A40', red: '#D9362B', 'stripe-a': '#141415', 'stripe-b': '#F7A71B', 'stripe-c': '#141415',
      shadow: '0 10px 28px rgba(20, 20, 21, .26)'
    },
    dark: {
      bg: '#0A0A0B', surface: '#141416', ink: '#F3F1EA', muted: '#A9A69B', line: '#2D2D31', hover: '#1B1B1E',
      panel: '#070708', 'panel-2': '#111113', 'panel-line': '#34343A', 'accent-text': '#FFC04D', focus: '#FFC04D',
      blue: '#D9D6CB', red: '#FF7A6B', shadow: '0 10px 28px rgba(0, 0, 0, .65)'
    },
    decor: `
{T} .arena > .wrap { position: relative; z-index: 1; }
{T} .arena::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(115deg, rgba(247, 167, 27, .10) 0 22px, transparent 22px 64px);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 70%); mask-image: linear-gradient(90deg, transparent, #000 70%); }`
  },

  ice: {
    // 3 vs 3 A: the electric blue of the Dek Mixte logo, with its pink as the second colour.
    mark: ['#1EA7E1', '#C9ECFA'],
    brand: 'linear-gradient(180deg, #B6E6FA 8%, #1EA7E1 92%)',
    light: {
      bg: '#E8F1F8', ink: '#08212F', muted: '#4F6B7D', line: '#CFDDE8', hover: '#F1F7FB',
      panel: '#071F33', 'panel-2': '#0C2C47', 'panel-line': '#1B4A6E', 'panel-ink': '#EFF8FD', 'panel-mute': '#8DB8D6',
      'led-on': '#4FC3F0', 'led-off': '#0E3150', ball: '#1EA7E1', 'on-ball': '#001B2B', 'accent-text': '#0B6FA0', focus: '#0B86C0',
      blue: '#0B86C0', red: '#E8457E', 'stripe-a': '#1EA7E1', 'stripe-b': '#E8457E', 'stripe-c': '#1EA7E1',
      shadow: '0 10px 28px rgba(7, 31, 51, .24)'
    },
    dark: {
      bg: '#050F18', surface: '#0B1B29', ink: '#E6F3FB', muted: '#8FB0C6', line: '#183A55', hover: '#102536',
      panel: '#04121D', 'panel-2': '#08202F', 'panel-line': '#164A6C', 'accent-text': '#5CC4F2', focus: '#5CC4F2',
      blue: '#5CC4F2', red: '#FF8AAE', shadow: '0 10px 28px rgba(0, 0, 0, .6)'
    },
    decor: `
{T} .arena > .wrap { position: relative; z-index: 1; }
{T} .arena::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(115deg, transparent 40%, rgba(120, 200, 245, .10) 40.2%, transparent 40.6%), linear-gradient(98deg, transparent 62%, rgba(120, 200, 245, .09) 62.2%, transparent 62.5%), radial-gradient(60% 90% at 85% 100%, rgba(30, 167, 225, .18), transparent); }`
  },

  asphalt: {
    // 3 vs 3 B: the black and silver of the Dek Mixte shield, with a blue and pink edge.
    mark: ['#C9CDD6', '#FFFFFF'],
    brand: 'linear-gradient(180deg, #FFFFFF 8%, #B4B9C6 92%)',
    light: {
      bg: '#EEEFF1', surface: '#FFFFFF', ink: '#15171C', muted: '#5E6470', line: '#D8DADF', hover: '#F5F6F8',
      panel: '#16181D', 'panel-2': '#21242B', 'panel-line': '#383C46', 'panel-ink': '#F5F6F8', 'panel-mute': '#A9AEBA',
      'led-on': '#E6E8EE', 'led-off': '#2A2D35', ball: '#C9CDD6', 'on-ball': '#14161A', 'accent-text': '#C42762', focus: '#C42762',
      blue: '#2B2F38', red: '#E8457E', 'stripe-a': '#16181D', 'stripe-b': '#E8457E', 'stripe-c': '#16181D',
      shadow: '0 10px 28px rgba(22, 24, 29, .26)'
    },
    dark: {
      bg: '#0C0D10', surface: '#15171B', ink: '#F0F1F4', muted: '#A0A5B0', line: '#2A2D35', hover: '#1B1D22',
      panel: '#08090B', 'panel-2': '#121418', 'panel-line': '#30333C', 'accent-text': '#FF7FA6', focus: '#FF7FA6',
      blue: '#C9CDD6', red: '#FF7FA6', shadow: '0 10px 28px rgba(0, 0, 0, .65)'
    },
    decor: `
{T} .arena > .wrap { position: relative; z-index: 1; }
{T} .arena::after { content: ""; position: absolute; inset: auto 0 0 0; height: 6px; pointer-events: none;
  background: linear-gradient(90deg, #1EA7E1 0 50%, #E8457E 50% 100%); }`
  },

  pitch: {
    // 4 vs 4 B: the pink and red side of the Dek Mixte logo, on a dark plum.
    mark: ['#E8457E', '#FFC4D9'],
    brand: 'linear-gradient(180deg, #FFC4D9 8%, #E8457E 92%)',
    light: {
      bg: '#F6EEF2', ink: '#2A0F1E', muted: '#7A5568', line: '#EAD6E0', hover: '#FBF5F8',
      panel: '#2A0D20', 'panel-2': '#3A1530', 'panel-line': '#5C2A4C', 'panel-ink': '#FFF3F8', 'panel-mute': '#D6A6C0',
      'led-on': '#FF6FA0', 'led-off': '#3E1832', ball: '#E8457E', 'on-ball': '#FFFFFF', 'accent-text': '#B01A56', focus: '#B01A56',
      blue: '#B01A56', red: '#E2552B', 'stripe-a': '#E8457E', 'stripe-b': '#1EA7E1', 'stripe-c': '#E8457E',
      shadow: '0 10px 28px rgba(42, 13, 32, .26)'
    },
    dark: {
      bg: '#12060E', surface: '#1E0C17', ink: '#FBEAF2', muted: '#C195AC', line: '#43203A', hover: '#271020',
      panel: '#16070F', 'panel-2': '#220C19', 'panel-line': '#4E2442', 'accent-text': '#FF8DB3', focus: '#FF8DB3',
      blue: '#FF8DB3', red: '#FF9A7A', shadow: '0 10px 28px rgba(0, 0, 0, .6)'
    },
    decor: `
{T} .arena > .wrap { position: relative; z-index: 1; }
{T} .arena::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(90deg, rgba(232, 69, 126, .08) 0 56px, transparent 56px 112px); }`
  }
};

const tokens = (o) => Object.entries(o).map(([k, v]) => `--${k}: ${v};`).join(' ');

export function themeCss() {
  let css = '';
  for (const [name, th] of Object.entries(THEMES)) {
    const T = `:root[data-league="${name}"]`;
    const light = { ...th.light, 'mark-a': th.mark[0], 'mark-b': th.mark[1], ...(th.brandFont ? { 'f-brand': th.brandFont } : {}) };
    css += `/* theme: ${name} */\n${T} { ${tokens(light)} }\n`;
    css += `@media (prefers-color-scheme: dark) { ${T}:not([data-theme="light"]) { ${tokens(th.dark)} } }\n`;
    css += `${T}[data-theme="dark"] { ${tokens(th.dark)} }\n`;
    css += `${T} .brand b i { background: ${th.brand}; -webkit-background-clip: text; background-clip: text; color: transparent; }\n`;
    if (th.decor) css += th.decor.replace(/\{T\}/g, T).trim() + '\n';
  }
  return css;
}


// Scoped tokens for the league cards on the LDHML home page (the page itself uses the default theme).
export function cardCss() {
  const keys = ['panel', 'panel-2', 'panel-line', 'panel-ink', 'panel-mute', 'ball', 'on-ball', 'stripe-a', 'stripe-b', 'stripe-c', 'led-on'];
  let css = '';
  for (const [name, th] of Object.entries(THEMES)) {
    const t = {};
    for (const k of keys) if (th.light[k]) t[k] = th.light[k];
    if (th.brandFont) t['f-brand'] = th.brandFont;
    t['mark-a'] = th.mark[0]; t['mark-b'] = th.mark[1];
    t.brand = th.brand;
    css += `[data-t="${name}"] { ${tokens(t)} }\n`;
  }
  return css;
}
