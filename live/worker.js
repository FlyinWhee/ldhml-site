// The live stats site, https://ldhml.com/ (owner, 2026-11-20: GitHub Pages is the dev/staging copy, ldhml.com the live one).
// It only serves the files that build.mjs made (dist/ of main, copied to dist-live/ without the branch previews).
// It never fetches NBHPA (hard rule 1): visitors' browsers read the live data themselves, like on GitHub Pages.
// www.ldhml.com redirects to ldhml.com, so the site has one address (one set of cookies, one installed app).
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.hostname === 'www.' + env.SITE_HOST) {
      url.hostname = env.SITE_HOST;
      return Response.redirect(url.href, 301);
    }
    return env.ASSETS.fetch(req);
  }
};
