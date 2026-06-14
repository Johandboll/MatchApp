const fs = require("fs");
const path = require("path");

const teams = require("../src/data/teams.json");

const sqlString = (value) => String(value).replace(/'/g, "''");
const rows = [];

teams.forEach((team) => {
  (team.players || []).forEach((player) => {
    const shirtNumber = Number(player.shirtNumber ?? player.nr);
    const role = player.role === "goalkeeper" ? "goalkeeper" : "field";
    rows.push(
      `  ('${sqlString(team.id)}', ${shirtNumber}, '${sqlString(player.name)}', '${role}')`
    );
  });
});

const sql = `insert into public.players (team_id, shirt_number, name, role)
select t.id, v.shirt_number, v.name, v.role
from public.teams t
join (values
${rows.join(",\n")}
) as v(team_slug, shirt_number, name, role) on v.team_slug = t.slug
on conflict (team_id, name) do update
set shirt_number = excluded.shirt_number,
    role = excluded.role,
    active = true;
`;

fs.mkdirSync(path.join(__dirname, "..", "supabase"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "supabase", "seed_players.sql"), sql);
