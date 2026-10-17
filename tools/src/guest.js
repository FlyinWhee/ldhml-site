// A replacement player who is not on the list ("joueur hors-ligue"), typed by a captain or an admin.
// Kept on the request line only (never a people row). Name and sex required; age and NBHPA no. optional
// (age matters only in leagues with an age rule). Returns { name, sex, age, nid } or null when not valid.
import { cleanText } from './http.js';

export function cleanGuest(g) {
  const name = cleanText(g && g.name, 80), sex = g && (g.sex === 'm' || g.sex === 'f') ? g.sex : null;
  const age = g && g.age != null && g.age !== '' ? Number(g.age) : null, nid = g && g.nid ? String(g.nid).trim() : null;
  if (!name || !sex || (age !== null && (!Number.isInteger(age) || age < 10 || age > 120)) || (nid && !/^\d{1,12}$/.test(nid))) return null;
  return { name, sex, age, nid };
}
