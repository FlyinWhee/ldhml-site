// Seasons: one season "active" (en cours) at a time; it is the reference for the tools (the admin pages open on it,
// captains work in it) and, through GET /api/public/season, for the public site (npm run season:check).
// An archived season is read only: every write of a season's data is refused (409 season_archived). Its status can
// always be changed back. Read docs/tools.md.

/** The status of a season ('upcoming' | 'active' | 'archived'), or null when it does not exist. */
export const seasonStatus = (DB, id) => DB.prepare('SELECT status FROM seasons WHERE id = ?').bind(Number(id) || 0).first('status');

/** true when the season is archived (read only). */
export const isArchived = async (DB, id) => (await seasonStatus(DB, id)) === 'archived';

/** The live season (en cours), or null. */
export const liveSeason = (DB) => DB.prepare("SELECT id, key, name, nbhpa_season_id FROM seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1").first();

/** Statements that archive every other active season (one active season at a time). */
export const archiveOthers = (DB, id) => DB.prepare("UPDATE seasons SET status = 'archived' WHERE status = 'active' AND id <> ?").bind(id);
