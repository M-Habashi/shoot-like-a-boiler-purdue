# Shoot Like a Boiler

How Purdue women's basketball shot in 2025-26, compared with the other 360 teams: points per shot by court spot and shot type, national ranks, where the edge came from, and home crowd size.

Live page: https://m-habashi.github.io/shoot-like-a-boiler-purdue/

Draft for the Purdue Boiler Up, Hammer Data Challenge.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The page |
| `css/style.css` | Styles (dark, Purdue black and gold) |
| `js/app.js` | Draws the figures and animations from the data file |
| `js/vendor/` | Paper Shaders (light rays, Apache-2.0) and tsParticles (gold dust, MIT), with licenses |
| `data/purdue-2025-26.json` | Every number on the page |
| `data/purdue-2025-26.js` | The same data as a script, used when the page is opened from disk |
| `img/` | Arena picture (AI-generated, not a real arena) and the Purdue logo |

No build step and no server code. To view it locally, open `index.html`, or run `python -m http.server` in this folder and visit http://localhost:8000. Add `?static` to the address to see the page with no motion. The page also follows the system "reduce motion" setting.

## Data and methods

Official competition files: ESPN play-by-play, schedule and team files for NCAA women's basketball, from the SportsDataverse wehoop package, season 2025-26. The full calculation methods (shot filters, definitions, ranks, margin of error and checks) are in the "Calculation methods" section at the bottom of the page.

The figures describe patterns. They do not show what caused them.

## Credits

Made with AI help (Claude, Codex). The arena picture was made with an AI image tool and is not a real arena. The Purdue logo comes from the supplied teams file; usage rights are to be confirmed before any submission. Light rays: Paper Shaders (Apache-2.0). Gold dust: tsParticles (MIT). Licenses are in `js/vendor/`.
