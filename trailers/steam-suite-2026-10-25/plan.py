#!/usr/bin/env python3
"""Build the paper edits. Copy JSONs into the output project to revise freely."""
import argparse
import json
from pathlib import Path


def shot(name, duration, start=.2, title=None, zoom=None, **extra):
    detail = {
        "card-shop": ([1.3, 1.4], [.5, .45]),
        "armory-loadout": ([1.1, 1.16], [.48, .47]),
        "homestead-build": ([1.28, 1.36], [.5, .47]),
        "homestead-companions": ([1.28, 1.36], [.5, .47]),
        "talents-block": ([1.22, 1.28], [.5, .47]),
    }
    if name in detail:
        zoom, focus = detail[name]
        extra["focus"] = focus
    return {"source": ("detail-selects/" if name in detail else "current-selects/") + name, "in": start, "duration": duration,
            **({"title": title} if title else {}),
            **({"zoom": zoom} if zoom else {}), **extra}


def end(accent="gold"):
    return {"end": True, "duration": 4, "accent": accent}


def create(project):
    analyses = json.loads((project / "review/music-analysis.json").read_text())

    def snap(shots, track, offset=0):
        # Only adjust neutral shot tails, keeping complete inspection/play/impact.
        # Native Countess lyrics never use this fitting pass.
        cursor = 0
        accents = analyses[track]["accents"]
        for i, s in enumerate(shots[:-1]):
            wanted = cursor + s["duration"]
            candidates = [x-offset for x in accents if abs(x-offset-wanted) < .24]
            if candidates and s.get("source", "").startswith(("current-selects/", "detail-selects/")):
                nearest = min(candidates, key=lambda x: abs(x-wanted))
                adjusted = round((nearest-cursor)*60)/60
                if .2 + adjusted <= 5.5 and adjusted >= 4.5:
                    s["duration"] = adjusted
            cursor += s["duration"]
        return shots

    timelines = [
        {
            "id": "01-every-card-counts", "name": "Every Card Counts",
            "intent": "One complete three-spell turn establishes cause and consequence before showing ways to develop the next build.",
            "music": {"file": "audio/Battle 3.mp3", "in": .19, "fade": 2.0},
            "shots": [
                {"source": "wizard-turn/wizard-turn", "in": 0, "duration": 16, "title": "FIND YOUR COMBINATION"},
                shot("card-shop", 4.9, title="SHAPE YOUR DECK", zoom=[1.04,1.12]),
                shot("talents-block", 4.9, zoom=[1.04,1.1]),
                shot("treant-druid", 5.1, title="TEST IT AGAINST THE BOSSES"),
                shot("seraph-wizard", 4.9),
                shot("titan-knight", 4.9), end(),
            ],
        },
        {
            "id": "02-a-run-through-alchemy", "name": "A Run Through Alchemy",
            "intent": "A broad journey through battle, purchases, route decisions, persistent growth and a boss challenge. Staged valid checkpoints, not a claimed uninterrupted run.",
            "music": {"file": "audio/Battle 1.mp3", "in": 10.12, "fade": 2.2},
            "shots": [
                shot("labyrinth-route",4.9,title="CHOOSE YOUR PATH"),
                {"source":"wizard-turn/wizard-turn","in":0,"duration":7.9},
                shot("card-shop",4.9,title="MAKE EVERY CHOICE COUNT",zoom=[1.03,1.12]),
                shot("potion-brewing",4.9,zoom=[1.05,1.14]),
                shot("armory-loadout",4.9,zoom=[1.03,1.1]),
                shot("homestead-build",4.9,title="BUILD BEYOND THE RUN",zoom=[1.02,1.1]),
                shot("talents-block",4.9,zoom=[1.02,1.1]),
                shot("seraph-wizard",4.9),
                shot("countess-neutral",5.1),end(),
            ],
        },
        {
            "id": "03-a-home-worth-fighting-for", "name": "A Home Worth Fighting For",
            "intent": "The quieter progression treatment: leave battle, recover, build a Blacksmith, bond with a companion, prepare and return to the fight.",
            "music": {"file":"audio/Menu 3.mp3","in":.48,"fade":3},
            "sfx": .7,
            "shots": [
                shot("treant-druid",5.1,title="A HOME WORTH FIGHTING FOR"),
                shot("campfire-rest",4.9,zoom=[1.04,1.12]),
                shot("homestead-build",5.1,title="BUILD BEYOND THE RUN",zoom=[1.02,1.1]),
                shot("homestead-companions",5.1,title="FIND AN ALLY",zoom=[1.03,1.1]),
                shot("armory-loadout",4.9,zoom=[1.03,1.1]),
                shot("talents-block",4.9,zoom=[1.02,1.1]),
                {"source":"combat-stories/druid-counterplay","in":0,"duration":16},end(),
            ],
        },
        {
            "id": "04-the-boss-gauntlet", "name": "The Boss Gauntlet",
            "intent": "A battle-first challenge reel. Two complete defensive turns include enemy responses; short Seraph and Countess accents add contrasting threats.",
            "music": {"file":"audio/Battle 3.mp3","in":32.2,"fade":1.8},
            "shots": [
                {"source":"combat-stories/knight-fortress","in":0,"duration":16,"title":"STAND YOUR GROUND"},
                shot("seraph-wizard",5.1,start=0),
                {"source":"combat-stories/druid-counterplay","in":0,"duration":16},
                shot("countess-neutral",5.1,start=0),
                end("blood"),
            ],
        },
        {
            "id": "05-countess-one-more-heartbeat", "name": "One More Heartbeat",
            "intent": "A continuous Countess performance from the original song beginning through the first full chorus. No lyric overlay, reordering or changed gameplay speed.",
            "music": {"file":"audio/countess.mp3","in":0,"fade":3.0},
            "sfx": .38,
            "shots": [
                {"source":"countess-performance/countess-performance","in":0,"duration":88.5,"title":"THE BLOOD COUNTESS","accent":"blood","titleDuration":4},
                end("blood"),
            ],
        },
    ]
    for t in timelines:
        if t["id"].startswith(("01","02","03","04")):
            snap(t["shots"], Path(t["music"]["file"]).name, t["music"].get("in",0))
        (project / "timelines" / f"{t['id']}.json").write_text(json.dumps(t,indent=2)+"\n")
        print(t["id"],round(sum(s["duration"]for s in t["shots"]),3))


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--project",type=Path,required=True)
    create(parser.parse_args().project)
