// "Today" in Montréal (America/Toronto), as YYYY-MM-DD. The online demo can run on a simulated date (DEMO_TODAY, owner
// 2026-11-20: the season was over, so a captain had no upcoming game to try): set per request by worker.js, demo only.
let fixed = null;
export const setToday = (d) => { fixed = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null; };
export const today = () => fixed || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
export const simulated = () => fixed;
