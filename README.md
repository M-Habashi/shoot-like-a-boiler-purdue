# Shoot Like a Boiler: Where Purdue Women's Basketball Outshot the Field in 2025-26

Using 682,096 field-goal attempts across 361 NCAA women's basketball teams in the 2025-26 season, *Shoot Like a Boiler* explores where shots produce the most points and how Purdue compared. Purdue ranked 38th nationally at the rim (top 11%) and 81st overall. Separating shot location from conversion shows Purdue's advantage came from shot-making rather than shot selection, worth about 3.9 field-goal points per game, in front of a top-5% home crowd (5,203 median attendance).

Live page: https://m-habashi.github.io/shoot-like-a-boiler-purdue/

Created for the Purdue Boiler Up, Hammer Data Challenge (Love Data Week 2027).

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The page |
| `css/style.css` | Styles (dark, Purdue black and gold) |
| `js/app.js` | Draws the figures and animations from the data file |
| `js/vendor/` | Paper Shaders (light rays, Apache-2.0) and tsParticles (gold dust, MIT), with licenses |
| `data/purdue-2025-26.json` | Every number on the page |
| `data/purdue-2025-26.js` | The same data as a script, used when the page is opened from disk |
| `img/` | Arena backdrop and the Purdue logo |

No build step and no server code. To view it locally, open `index.html`, or run `python -m http.server` in this folder and visit http://localhost:8000. Add `?static` to the address to see the page with no motion. The page also follows the system "reduce motion" setting.

## Data and methods

Official competition files: ESPN play-by-play, schedule and team files for NCAA women's basketball, from the SportsDataverse wehoop package, season 2025-26. Filters, zone definitions, ranks, sensitivity ranges, and limits are summarized in the **Data & methods** section at the bottom of the page.

The figures describe patterns. They do not show what caused them.
