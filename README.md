# Word Chain

A deep ocean themed word game. Each word has to start with the letters the last word ended on. Play against an AI, keep your streak alive, and try to not run out of time.

## How it works

- Each word must begin with the end of the previous word: `lio`**`n`** then **`n`**`ight`.
- The matching letters are already typed for you. The word can be just those letters, like `me` after `so`**`me`**.
- You have 20 seconds per turn. No word can be used twice in a match.
- You get 5 tries per word, shown as five bubbles. Every word that is not in the dictionary pops one, and losing all five ends the match. Wrong starting letters, words already used and failed online lookups do not cost a bubble.
- **Escalating** mode makes longer matches (2 and 3 letters) more common as your streak grows: they become common from a streak of 50 and take over from 150. You can also fix the match at 1, 2 or 3 letters.

### Scoring

- 10 points per letter.
- Words longer than 5 letters earn a growing bonus, with no limit.
- Matching 2 letters multiplies the word by 1.5, and 3 letters by 2.
- Each word in a row adds 0.05 to a streak multiplier, with no upper limit.
- Your best score and best streak are saved in your browser. Each one shows the other number from the same match, since the longest streak is not always the highest score.

### Depth and sound

- The water gets deeper as your streak grows, down to the abyss at a streak of 250. The light fades, the background darkens and glowing specks appear. The depth shows at the top, next to the settings.
- **Ocean sound** (off by default) is generated live in your browser with the Web Audio API, so there are no audio files. Near the surface it is bright, with soft chimes. Further down it gets darker and slower, with a deep hum and distant whale calls.
- Open **settings** for volume, a mix of the five layers (water, harmony, chimes, deep hum, calls) and a depth preview. Turn off "follow my streak" to move the slider and see and hear any depth. Settings are saved in your browser.

### Opponents

- **Easy** and **Medium** play everyday words.
- **Master** picks words that leave you the fewest ways to answer.

### Other options

- **Common words only** limits you and the AI to everyday words.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game: page, styles and script. |
| `words.txt` | Accepted words (ENABLE word list, about 173,000 words). |
| `common.txt` | Everyday words ranked by frequency, used by the AI and "common words only". |

Words that are not in `words.txt` (names, places, newer words) are checked against English Wiktionary. The clock waits during that lookup, up to 6 seconds per turn.

## Credits

- Word list: [ENABLE](https://github.com/dolph/dictionary) (public domain).
- Everyday-word ranking: [FrequencyWords](https://github.com/hermitdave/FrequencyWords) by hermitdave, filtered to the ENABLE list.
- Online lookups: English Wiktionary.
- Fonts: Lora, DM Sans and DM Mono from Google Fonts.
