# Word Chain

A deep-ocean themed word game. Each word has to start with the letters the last word ended on. Play against an AI, keep your streak alive, and try to not run out of time.

## How it works

- A random everyday word opens every match, and you answer it.
- Each word must begin with the end of the previous word: `lio`**`n`** then **`n`**`ight`.
- The matching letters are already typed for you. The word can be just those letters, like `me` after `so`**`me`**.
- You have 20 seconds per turn. No word can be used twice in a match.
- You get 5 tries per word, shown as five bubbles. Every word that is not in the dictionary pops one, and losing all five ends the match. Wrong starting letters, words already used and failed online lookups do not cost a bubble.
- **Escalating** mode has six phases, one for every 50 of streak, from phase 0 (streak 0) to phase 5 (streak 250 and up). Each phase has its own chance of needing to match 1 to 6 letters, and the odds are shown next to the chain. You can also fix the match at 1, 2 or 3 letters.

### Phases

| Phase | Streak | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 Shallows | 0-49 | 75% | 20% | 5% | | | |
| 1 Drifting | 50-99 | 50% | 35% | 13% | 2% | | |
| 2 Sinking | 100-149 | 30% | 42% | 22% | 6% | | |
| 3 Twilight | 150-199 | 18% | 38% | 30% | 12% | 2% | |
| 4 Midnight | 200-249 | 10% | 32% | 34% | 19% | 5% | |
| 5 Abyss | 250+ | 5% | 25% | 35% | 24% | 10.5% | 0.5% |

A long match is only used when some unused word can follow it. Otherwise the game falls back to a shorter one, so you are never handed an impossible match, and in practice the longest matches show up even less often than the table says.

### Scoring

- 10 points per letter.
- Words longer than 5 letters earn a growing bonus, with no limit.
- Each extra matching letter adds 0.5 to the word's multiplier: 2 letters is x1.5, 3 is x2, up to x3.5 for 6.
- Each word in a row adds 0.05 to a streak multiplier, with no upper limit.
- Your best score and best streak are saved in your browser. Each one shows the other number from the same match, since the longest streak is not always the highest score.

### Depth and sound

- The water gets deeper as your streak grows, down to the abyss at a streak of 250. The light fades, the background darkens and glowing specks appear. The depth shows at the top, next to the settings link.
- **Ocean sound** (off by default) is generated live in your browser with the Web Audio API, so there are no audio files. Near the surface it is bright, with soft chimes. Further down it gets darker and slower, with bubbles, a deep hum and distant whale calls. Near the abyss you also hear a giant metal structure groaning, far clangs and slow, uneasy swells, and a faint tower of girders appears in the dark.
- Open **settings** for volume, a mix of the eight layers (water, harmony, chimes, deep hum, calls, bubbles, metal, dread) and a depth preview. Once you have reached a streak of 250, you can turn off "follow my streak" and move the slider to see and hear any depth. The menu clears while you drag so you can watch the water change. Settings are saved in your browser.
- Browsers only allow sound after a click or key press, so if sound was on last time it starts again at your first click.

### Stats

The **stats** panel keeps records, totals, averages, word lengths, how your matches ended, streak milestones and results per opponent. It sits next to settings and has a button to erase everything saved in the browser (records, stats and settings). It asks you to press twice.

### Fair play

- Words have to be typed one letter at a time. Pasting, dropping text into the box, swipe typing and tapping a suggested word are blocked.
- The opponent, tail length, common words only and Start are locked while a match is running.
- Words can only use the letters A to Z, so phrases and hyphenated words are not accepted.
- The turn clock follows the real time, so it cannot be stalled by freezing the page or by spamming online lookups.
- Official records should come with a video of the match, since nothing in the browser can prove a score.
- Records and stats live in your own browser and can be edited by anyone with developer tools. A game with no server cannot prevent that, so scores are for you, not for a public leaderboard.

### Opponents

Your opponent is a lapis lazuli gem. Pick its quality next to the chain.

- **Broken** plays short, very common words (3 to 6 letters) and picks the ones that leave you the most ways to answer. It also takes a little longer to reply.
- **Impure** plays a wider and steadier range of everyday words, longer ones included, and avoids dead ends, but has no plan against you.
- **Perfect** picks words that leave you the fewest ways to answer.

### Other options

- **Common words only** limits you and the gem to everyday words. It is locked while a match is running.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game: page, styles and script. |
| `words.txt` | Accepted words (172,823). |
| `common.txt` | Everyday words (32,542) ranked by frequency, used by the AI and "common words only". |

Words that are not in `words.txt` (names, places, newer words) are checked against English Wiktionary. The clock waits during that lookup, up to 6 seconds per turn.

## Credits

- Word list: [ENABLE](https://github.com/dolph/dictionary) (public domain).
- Everyday-word ranking: [FrequencyWords](https://github.com/hermitdave/FrequencyWords) by hermitdave, filtered to the ENABLE list.
- Online lookups: English Wiktionary.
- Fonts: Lora, DM Sans and DM Mono from Google Fonts.
