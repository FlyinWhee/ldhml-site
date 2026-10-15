# site/

Front-end source. Read `../CLAUDE.md` and `../docs/frontend.md` first.

- `template.html`: league page shell. Three placeholders (`/*__CSS__*/`, `/*__JS__*/`, `/*__DATA__*/`) are filled by `build.mjs`. Do not rename them. Element ids used by JS: `app, top, band, main, foot, boxload, picker, more, tabbar`.
- `style.css`: all CSS (hub and leagues). Tokens first, themes appended by the build.
- `themes.mjs`: league themes. Pure data plus `themeCss()` and `cardCss()`.
- `js/`: league page scripts (concatenated, one scope). See `js/CLAUDE.md`.
- `hub/`: the hub page. Separate app.
- `test-*.mjs`: jsdom tests of the built pages (run through `npm test`). See `../docs/testing.md`.

Before you finish: `npm test`, then look at the page in a browser at desktop and 400 px width.
