// Parser tests using row samples copied from the live NBHPA pages (2026-10-09).
import assert from 'node:assert/strict';
import { parseStandings, parsePlayers, parseGoalies, parseSchedule, parseRecap } from './lib.mjs';

const teams = [
  { id: '204339', abb: 'TOP' }, { id: '204208', abb: 'FLI' },
  { id: '204260', abb: 'GHO' }, { id: '204207', abb: 'JAW' },
];

const playedRow = `<table><tr class=" position-relative schedule_container border ">
<td class="text-nowrap position-relative">
 <div class="d-inline-block align-bottom mr-3 cat_name"><span>LDHML RETRO </span></div>
 <div class="d-none d-md-inline-block">
  <div class="photo_container"><a href="https://cphjoliette.com/equipes/204339" target="_parent"><img></a></div>
  <div class="team_name d-inline-block align-middle mr-3"><a href="https://cphjoliette.com/equipes/204339" target="_parent">TOP GUN</a></div>
  <div class="d-inline-block align-middle mr-3"> @ </div>
  <div class="photo_container"><a href="https://cphjoliette.com/equipes/204208" target="_parent"><img></a></div>
  <div class="team_name d-inline-block align-middle"><a href="https://cphjoliette.com/equipes/204208" target="_parent">Flintstones</a></div>
 </div>
 <div class="team_name width_auto d-inline-block d-md-none align-middle">
  <div class="full_width"><a href="https://cphjoliette.com/equipes/204339">TOP GUN</a></div>
  <div class="full_width">@ <a href="https://cphjoliette.com/equipes/204208">Flintstones</a></div>
 </div>
</td>
<td class="text-nowrap"><div class="game_date"> Mercredi<br> 2026-09-16 </div></td>
<td class="text-nowrap"><div class="game_date"> 18:00 </div><div class="game_venue"> Surface Aménagement Belgam(1) </div>
 <span class="score text-uppercase">TOP 10, </span> <span class="score loser">FLI 7</span></td>
<td class="border-right text-nowrap" colspan="2"><a href="https://cphjoliette.com/sommaire/2539180" title="SOMMAIRE"></a></td>
</tr></table>`;

const futureRow = `<table><tr class=" position-relative schedule_container border ">
<td><div class="d-none d-md-inline-block">
  <a href="https://cphjoliette.com/equipes/204260"><img></a><div class="team_name d-inline-block align-middle mr-3"><a href="https://cphjoliette.com/equipes/204260">Ghostbusters</a></div>
  <a href="https://cphjoliette.com/equipes/204207"><img></a><div class="team_name d-inline-block align-middle"><a href="https://cphjoliette.com/equipes/204207">Jaws</a></div>
</div></td>
<td><div class="game_date"> Mercredi<br> 2026-11-18 </div></td>
<td><div class="game_date"> 21:45 </div><div class="game_venue"> Surface Aménagement Belgam(1) </div></td>
<td><a href="https://cphjoliette.com/sommaire/2539257" title="FACE À FACE"></a></td>
</tr></table>`;

const games = parseSchedule(playedRow + futureRow, teams);
assert.equal(games.length, 2);
assert.deepEqual(games[0], {
  id: '2539180', date: '2026-09-16', time: '18:00', venue: 'Surface Aménagement Belgam', court: '1',
  away: '204339', home: '204208', as: 10, hs: 7, cancelled: false,
});
assert.equal(games[1].as, null);
assert.equal(games[1].hs, null);
assert.equal(games[1].id, '2539257');
assert.equal(games[1].away, '204260');

const standings = parseStandings({
  0: { pk: null, values: [
    { key: 'team_id', val: '204260' }, { key: 'team_name', val: 'Ghostbusters' }, { key: 'team_abb', val: 'GHO' },
    { key: 'team_pic', val: 'team_pics_small/x.jpg' }, { key: 'position', val: 1 }, { key: 'gp', val: 4 },
    { key: 'wins_tot', val: 4 }, { key: 'losses', val: 0 }, { key: 'ot', val: 0 }, { key: 'ot_loss', val: 0 },
    { key: 'pts', val: 8 }, { key: 'gf', val: 25 }, { key: 'ga', val: 15 }, { key: 'diff', val: 10 }, { key: 'pts_gp', val: '2.00' },
  ] },
  length: 1, last_update: '2026-10-09 07:05:36', cache: 'abc',
});
assert.equal(standings.length, 1);
assert.equal(standings[0].pts, 8);
assert.equal(standings[0].ppg, 2);

const statsHtml = (rows) => `<script>\n var league_id = 10;\n var stats_player = ${JSON.stringify(rows)};\n var order = 'desc';\n</script>`;
const pl = parsePlayers(statsHtml([{ player_id: '1', nbhpa_player_id: '9', full_name: 'Jean-Pascal  Desrosiers ', sex: 'm',
  ranking: 'N/C', teams: 'FLI', mj: '4', g: '9', a: '3', p: '12', pen: '0', bg: '1' }]));
assert.equal(pl[0].name, 'Jean-Pascal Desrosiers');
assert.equal(pl[0].p, 12);
assert.deepEqual(pl[0].teams, ['FLI']);

const gl = parseGoalies(statsHtml([{ player_id: '2', nbhpa_player_id: '8', full_name: 'Mathieu Bonin', sex: 'm', ranking: 'H12',
  teams: 'TOP', mj: '4', w: '4', l: '0', t: '0', sa: '68', sv: '53', ga: '15', pct: '0.779', gaa: '3.750', gaat: '4.69',
  so: '1', mp: '8640', minutes_per_period: '12', periods_per_game: '3' }]));
assert.equal(gl[0].pct, 0.779);
assert.equal(gl[0].so, 1);

// ---- game recap (markup copied from game 2539180 and 2539184, shortened) ----
const skRow = (id, no, name, v) => `<tr><td class="text-left"><a href="https://cphjoliette.com/joueur/${id}"><div class="player_name_container"><div class="player_number">${no}</div><div class="player_name pl-2"> ${name} </div></div></a></td>${v.map((x) => `<td class="text-center"> ${x} </td>`).join('')}</tr>`;
const hdrSk = ['Joueurs', 'B', 'A', 'P', 'PUN', 'BAN', 'PAN', 'BIN', 'PIN', 'BG', 'BE'].map((h) => `<th><span>${h}</span></th>`).join('');
const hdrGk = ['Gardiens', 'V', 'D', 'N/DP', 'TC', 'Arr', 'BC', '%Arr', 'BL', 'B', 'A', 'P', 'PUN'].map((h) => `<th><span>${h}</span></th>`).join('');
const recapHtml = `<html><body>
<h1 class="team_name"><a href="https://cphjoliette.com/equipes/204208">Flintstones</a></h1>
<table class="stats_table"><tbody><tr>${hdrSk}</tr></tbody><tbody class="data_list">
${skRow(310215, 6, 'M. JOBIN', [3, 3, 6, '-', 0, 0, 0, 0, 0, 0])}${skRow(544401, 50, 'M. BEAUDOIN', [2, 1, 3, 2, 0, 0, 0, 0, 1, 0])}</tbody></table>
<table class="stats_table"><tbody><tr>${hdrGk}</tr></tbody><tbody class="data_list"></tbody></table>
<h1 class="team_name"><a href="https://cphjoliette.com/equipes/204339">TOP GUN</a></h1>
<table class="stats_table"><tbody><tr>${hdrSk}</tr></tbody><tbody class="data_list">
${skRow(296745, 14, 'N. BELLEROSE', [4, 0, 4, '-', 0, 0, 0, 0, 0, 0])}</tbody></table>
<table class="stats_table"><tbody><tr>${hdrGk}</tr></tbody><tbody class="data_list">
<tr><td><a href="https://cphjoliette.com/joueur/637992"><div class="player_name_container"><div class="player_number"></div><div class="player_name"> M. BONIN </div></div></a></td>
${[1, 0, 0, 23, 16, 7, 0.696, 0, 0, 0, 0, '-'].map((x) => `<td> ${x} </td>`).join('')}</tr></tbody></table>
<div class="stars_title">Étoiles du match</div>
<table class="toggle_score_table"><tr><th>BUTS</th><th>1</th><th>2</th><th>3</th><th>T</th></tr><tr><td>Flintstones</td><td>1</td><td>5</td><td>1</td><td>7</td></tr><tr><td>TOP GUN</td><td>1</td><td>4</td><td>5</td><td>10</td></tr></table>
<table class="toggle_score_table"><tr><th>TIRS</th><th>TOTAL</th></tr><tr><td>Flintstones</td><td>23</td></tr><tr><td>TOP GUN</td><td>16</td></tr></table>
<div class="row"><div class="col-12 ultra_light_grey_background text-muted"> 1re Période </div>
<div class="col-12 goal_details"><div class="goal_details_main"><div class="text-muted">07:30 - TOP</div><h2 class="player_name"><a href="https://cphjoliette.com/joueur/296745">N. Bellerose</a> (1)</h2><div class="assists text-muted"></div></div></div>
<div class="col-12 ultra_light_grey_background text-muted"> 2e Période </div>
<div class="col-12 goal_details"><div class="goal_details_main"><div class="text-muted">10:00 - FLI</div><h2 class="player_name"><a href="https://cphjoliette.com/joueur/310215">M. Jobin</a> (2)</h2><div class="assists text-muted"><a href="https://cphjoliette.com/joueur/544401">M. Beaudoin </a> (1)</div></div></div>
<div class="col-12 goal_details"><div class="goal_details_main"><div class="text-muted">02:22 - TOP</div><h2 class="player_name">Équipe (0)</h2><div class="assists text-muted"></div></div></div></div>
<table class="penalties_container"><tbody>
<tr class="ultra_light_grey_background text-muted"><td colspan="3"> 1re Période </td></tr><tr><td colspan="3"> Aucune pénalité </td></tr>
<tr class="ultra_light_grey_background text-muted"><td> 2e </td><td> Équipe </td><td> Pénalité </td></tr>
<tr><td> 11:05 </td><td> FLI </td><td class="penalty_description"><a href="https://cphjoliette.com/joueur/544401">Marie Beaudoin</a> mineure </td></tr>
<tr><td> 01:11 </td><td> TOP </td><td class="penalty_description"><a href="https://cphjoliette.com/joueur/0"></a> mineure </td></tr></tbody></table>
</body></html>`;
const rc = parseRecap(recapHtml);
assert.deepEqual(rc.game.t.map((x) => x.id), ['204208', '204339']);
assert.deepEqual(rc.game.t[0].sk[0], ['310215', '6', 3, 3, 0, 0, 0, 0, 0, 0, 0]);
assert.deepEqual(rc.game.t[0].sk[1], ['544401', '50', 2, 1, 2, 0, 0, 0, 0, 1, 0]);
assert.deepEqual(rc.game.t[1].gk[0], ['637992', 1, 0, 0, 23, 16, 7, 0, 0, 0, 0]);
assert.deepEqual(rc.game.t[0].gk, []);
assert.deepEqual(rc.game.pg, [[1, 5, 1], [1, 4, 5]]);
assert.deepEqual(rc.game.sh, [23, 16]);
assert.deepEqual(rc.game.goals, [[1, '07:30', 'TOP', '296745', []], [2, '10:00', 'FLI', '310215', ['544401']], [2, '02:22', 'TOP', null, []]]);
assert.deepEqual(rc.game.pens, [[2, '11:05', 'FLI', '544401', 'mineure'], [2, '01:11', 'TOP', null, 'mineure']]);
assert.equal(rc.names['310215'], 'M. JOBIN');

console.log('All parser tests passed.');
