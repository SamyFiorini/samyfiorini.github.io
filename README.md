# Word Chain

A deep ocean themed word game. Each word has to start with the letters the last word ended on. Play against an AI, keep your streak alive, and try to not run out of time.

## How it works

- Each word must begin with the end of the previous word: `lio`**`n`** then **`n`**`ight`.
- The matching letters are already typed for you. The word can be just those letters, like `me` after `so`**`me`**.
- You have 20 seconds per turn. No word can be used twice in a match.
- **Escalating** mode makes longer matches (2 and 3 letters) more common as the chain grows. You can also fix the match at 1, 2 or 3 letters.

### Scoring

- 10 points per letter.
- Words longer than 5 letters earn a growing bonus, with no limit.
- Matching 2 letters multiplies the word by 1.5, and 3 letters by 2.
- Each word in a row adds 0.05 to a streak multiplier, with no limit.
- Your best score is saved in your browser.

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
