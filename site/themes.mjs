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
    // Colours of the league logo: deep indigo, magenta, a touch of yellow.
    mark: ['#FF5B14', '#FFB48A'],
    brand: 'linear-gradient(180deg, #F6D635 8%, #DE3A93 92%)',
    light: {
      bg: '#EFEDF6', ink: '#16112E', muted: '#5F5B7A', line: '#DAD6E8', hover: '#F4F2FA',
      panel: '#130E2E', 'panel-2': '#1C1545', 'panel-line': '#352B66', 'panel-ink': '#F5F2FF', 'panel-mute': '#A8A1D0',
      'led-off': '#251B50', ball: '#DE3A93', 'on-ball': '#FFFFFF', 'accent-text': '#B3126F', focus: '#C21E84',
      blue: '#4A3FD6', red: '#DE3A93', 'stripe-a': '#4A3FD6', 'stripe-b': '#DE3A93', 'stripe-c': '#F6D635',
      shadow: '0 10px 28px rgba(19, 14, 46, .25)'
    },
    dark: {
      bg: '#0B0820', surface: '#141030', ink: '#EAE7FA', muted: '#A29CC8', line: '#2A2352', hover: '#1A1540',
      panel: '#0F0A28', 'panel-2': '#181240', 'panel-line': '#302760', 'accent-text': '#FF7CC4', focus: '#FF7CC4',
      blue: '#8F86FF', red: '#FF6FBF', shadow: '0 10px 28px rgba(0, 0, 0, .6)'
    },
    decor: `
{T} .arena > .wrap { position: relative; z-index: 1; }
{T} .arena::after { content: ""; position: absolute; inset: auto 0 0 0; height: 55%; pointer-events: none;
  background: repeating-linear-gradient(90deg, rgba(222, 58, 147, .16) 0 1px, transparent 1px 72px), repeating-linear-gradient(0deg, rgba(222, 58, 147, .16) 0 1px, transparent 1px 30px);
  -webkit-mask-image: linear-gradient(transparent, #000); mask-image: linear-gradient(transparent, #000); }`
  },

  vintage: {
    // Old wool sweaters and a wooden scoreboard: parchment, walnut, burgundy, brass.
    mark: ['#B88A2E', '#F2D8A0'],
    brand: 'linear-gradient(180deg, #F0D58C 10%, #C99A3A 90%)',
    font: "'Playfair Display', 'Georgia', 'Times New Roman', serif",
    light: {
      bg: '#EFE6D2', surface: '#FBF7EC', ink: '#2A1D14', muted: '#6E5D4C', line: '#DACBAE', hover: '#F5EEDC',
      panel: '#2A1B12', 'panel-2': '#36251A', 'panel-line': '#5A4230', 'panel-ink': '#F6EDD8', 'panel-mute': '#BFA98A',
      'led-on': '#E9B949', 'led-off': '#3A281B', ball: '#B88A2E', 'on-ball': '#1E1305', 'accent-text': '#8E2430', focus: '#8E2430',
      blue: '#1F3A5F', red: '#8E2430', good: '#2F6B3A', bad: '#8E2430',
      'stripe-a': '#8E2430', 'stripe-b': '#D9B45A', 'stripe-c': '#8E2430',
      shadow: '0 10px 28px rgba(42, 27, 18, .28)'
    },
    dark: {
      bg: '#15100B', surface: '#1E1710', ink: '#F0E6D2', muted: '#B5A388', line: '#3A2D20', hover: '#261C13',
      panel: '#100B07', 'panel-2': '#1A130C', 'panel-line': '#46341F', 'accent-text': '#E0707B', focus: '#E0B35C',
      blue: '#7FA3D6', red: '#E0707B', good: '#7BBF88', bad: '#E0707B', shadow: '0 10px 28px rgba(0, 0, 0, .6)'
    },
    decor: `
{T} .arena > .wrap { position: relative; z-index: 1; }
{T} .arena::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(90deg, rgba(217, 180, 90, .09) 0 2px, transparent 2px 14px);
  border-bottom: 3px double rgba(217, 180, 90, .55); }
{T} .brand b, {T} .arena h1, {T} .ph { font-weight: 800; letter-spacing: .02em; }
{T} .arena h1 { font-size: clamp(34px, 6.4vw, 78px); }
{T} .nav a { font-weight: 600; letter-spacing: 0; font-size: 15px; }
{T} .brand b { font-size: 26px; }`
  },

  draft: {
    // Draft night: broadcast blue and gold.
    mark: ['#FFC72C', '#FFF0B8'],
    brand: 'linear-gradient(180deg, #FFE17A 8%, #FFC72C 92%)',
    light: {
      bg: '#EDF0F9', ink: '#0B1233', muted: '#55608A', line: '#D5DBEE', hover: '#F3F5FC',
      panel: '#0A1A5C', 'panel-2': '#11267A', 'panel-line': '#2A3F9A', 'panel-ink': '#FFFFFF', 'panel-mute': '#A9B8F0',
      'led-on': '#FFC72C', 'led-off': '#12236E', ball: '#FFC72C', 'on-ball': '#1A1300', 'accent-text': '#1B3FD6', focus: '#1B3FD6',
      blue: '#1B3FD6', red: '#E23B3B', 'stripe-a': '#1B3FD6', 'stripe-b': '#FFC72C', 'stripe-c': '#1B3FD6',
      shadow: '0 10px 28px rgba(10, 26, 92, .26)'
    },
    dark: {
      bg: '#060A1F', surface: '#0E1534', ink: '#EAEEFF', muted: '#9AA6D6', line: '#1F2A5C', hover: '#131C45',
      panel: '#070E33', 'panel-2': '#0C1748', 'panel-line': '#26357F', 'accent-text': '#8FA8FF', focus: '#FFC72C',
      blue: '#8FA8FF', red: '#FF7A7A', shadow: '0 10px 28px rgba(0, 0, 0, .6)'
    },
    decor: `
{T} .arena > .wrap { position: relative; z-index: 1; }
{T} .arena::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(115deg, rgba(255, 199, 44, .10) 0 22px, transparent 22px 64px);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 70%); mask-image: linear-gradient(90deg, transparent, #000 70%); }`
  },

  ice: {
    // 3 vs 3 A: fast and small, so cold ice and one hot accent.
    mark: ['#14B8CC', '#C6F4FA'],
    brand: 'linear-gradient(180deg, #A5F1FA 8%, #14B8CC 92%)',
    light: {
      bg: '#E9F3F5', ink: '#07242C', muted: '#4E6E77', line: '#CFE1E5', hover: '#F1F8F9',
      panel: '#062A33', 'panel-2': '#0B3845', 'panel-line': '#1B5566', 'panel-ink': '#EFFBFD', 'panel-mute': '#8FC3CF',
      'led-on': '#3FE0F0', 'led-off': '#0C3A46', ball: '#14B8CC', 'on-ball': '#00262C', 'accent-text': '#0A7385', focus: '#0A8CA3',
      blue: '#0A8CA3', red: '#E8476B', 'stripe-a': '#14B8CC', 'stripe-b': '#E8476B', 'stripe-c': '#14B8CC',
      shadow: '0 10px 28px rgba(6, 42, 51, .24)'
    },
    dark: {
      bg: '#04141A', surface: '#0B222B', ink: '#E5F6F9', muted: '#8FB5BE', line: '#17414D', hover: '#0F2C37',
      panel: '#031920', 'panel-2': '#072630', 'panel-line': '#14505F', 'accent-text': '#5FD8E8', focus: '#5FD8E8',
      blue: '#5FD8E8', red: '#FF8AA3', shadow: '0 10px 28px rgba(0, 0, 0, .6)'
    },
    decor: `
{T} .arena > .wrap { position: relative; z-index: 1; }
{T} .arena::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(115deg, transparent 40%, rgba(143, 230, 244, .10) 40.2%, transparent 40.6%), linear-gradient(98deg, transparent 62%, rgba(143, 230, 244, .09) 62.2%, transparent 62.5%), radial-gradient(60% 90% at 85% 100%, rgba(63, 224, 240, .16), transparent); }`
  },

  asphalt: {
    // 3 vs 3 B: street court, grey asphalt and hazard yellow.
    mark: ['#FFC800', '#FFEFA6'],
    brand: 'linear-gradient(180deg, #FFE55C 8%, #FFC800 92%)',
    light: {
      bg: '#EEEDE8', surface: '#FFFEFA', ink: '#1A1A1C', muted: '#66655F', line: '#DAD8D0', hover: '#F5F4EF',
      panel: '#1B1B1F', 'panel-2': '#26262C', 'panel-line': '#3C3C45', 'panel-ink': '#F7F5EC', 'panel-mute': '#A8A69B',
      'led-on': '#FFD21F', 'led-off': '#2E2E35', ball: '#FFC800', 'on-ball': '#1A1500', 'accent-text': '#7A5A00', focus: '#9C7300',
      blue: '#2D2D35', red: '#D9362B', 'stripe-a': '#1B1B1F', 'stripe-b': '#FFC800', 'stripe-c': '#1B1B1F',
      shadow: '0 10px 28px rgba(27, 27, 31, .26)'
    },
    dark: {
      bg: '#0E0E10', surface: '#17171B', ink: '#F0EEE4', muted: '#A09E92', line: '#2C2C33', hover: '#1E1E24',
      panel: '#0A0A0C', 'panel-2': '#141418', 'panel-line': '#34343D', 'accent-text': '#FFD21F', focus: '#FFD21F',
      blue: '#C9C7BA', red: '#FF6B5E', shadow: '0 10px 28px rgba(0, 0, 0, .65)'
    },
    decor: `
{T} .arena > .wrap { position: relative; z-index: 1; }
{T} .arena::after { content: ""; position: absolute; inset: auto 0 0 0; height: 10px; pointer-events: none;
  background: repeating-linear-gradient(-45deg, #FFC800 0 12px, #1B1B1F 12px 24px); }`
  },

  pitch: {
    // 4 vs 4 B: a full-size court, mown-grass green.
    mark: ['#22A45D', '#BDF0D3'],
    brand: 'linear-gradient(180deg, #F2D56B 8%, #5BE08A 92%)',
    light: {
      bg: '#EAF2EC', ink: '#0A2216', muted: '#4F6B5B', line: '#CFE0D4', hover: '#F1F7F3',
      panel: '#0B2E1D', 'panel-2': '#11402A', 'panel-line': '#1F5E3E', 'panel-ink': '#F1FBF5', 'panel-mute': '#93C4A8',
      'led-on': '#5BE08A', 'led-off': '#123D28', ball: '#22A45D', 'on-ball': '#021A0D', 'accent-text': '#12703F', focus: '#12873F',
      blue: '#12703F', red: '#E2552B', 'stripe-a': '#22A45D', 'stripe-b': '#F2C94C', 'stripe-c': '#22A45D',
      shadow: '0 10px 28px rgba(11, 46, 29, .25)'
    },
    dark: {
      bg: '#05130C', surface: '#0C2017', ink: '#E6F6EC', muted: '#8FB8A0', line: '#18402B', hover: '#102B1E',
      panel: '#04160D', 'panel-2': '#082417', 'panel-line': '#17563A', 'accent-text': '#5BE08A', focus: '#5BE08A',
      blue: '#5BE08A', red: '#FF8A66', shadow: '0 10px 28px rgba(0, 0, 0, .6)'
    },
    decor: `
{T} .arena > .wrap { position: relative; z-index: 1; }
{T} .arena::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(90deg, rgba(91, 224, 138, .08) 0 56px, transparent 56px 112px); }`
  }
};

const tokens = (o) => Object.entries(o).map(([k, v]) => `--${k}: ${v};`).join(' ');

export function themeCss() {
  let css = '';
  for (const [name, th] of Object.entries(THEMES)) {
    const T = `:root[data-league="${name}"]`;
    const light = { ...th.light, ...(th.font ? { 'f-display': th.font } : {}) };
    css += `/* theme: ${name} */\n${T} { ${tokens(light)} }\n`;
    css += `@media (prefers-color-scheme: dark) { ${T}:not([data-theme="light"]) { ${tokens(th.dark)} } }\n`;
    css += `${T}[data-theme="dark"] { ${tokens(th.dark)} }\n`;
    css += `${T} .brand b i { background: ${th.brand}; -webkit-background-clip: text; background-clip: text; color: transparent; }\n`;
    if (th.decor) css += th.decor.replace(/\{T\}/g, T).trim() + '\n';
  }
  return css;
}

// Ball icon colours, read by the browser code.
export const MARKS = Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, v.mark]));

// Scoped tokens for the league cards on the LDHML home page (the page itself uses the default theme).
export function cardCss() {
  const keys = ['panel', 'panel-2', 'panel-line', 'panel-ink', 'panel-mute', 'ball', 'on-ball', 'stripe-a', 'stripe-b', 'stripe-c', 'led-on'];
  let css = '';
  for (const [name, th] of Object.entries(THEMES)) {
    const t = {};
    for (const k of keys) if (th.light[k]) t[k] = th.light[k];
    if (th.font) t['f-display'] = th.font;
    t.brand = th.brand;
    css += `[data-t="${name}"] { ${tokens(t)} }\n`;
  }
  return css;
}
