# Mentor Mode: Explain the Code Without Hand-Waving

Series: DEBO Student Terminal
Runtime: 90 seconds

## Hook

The terminal becomes a personal tutor for code comprehension.

## Script

# Episode 05: Mentor Mode

Runtime target: 90 seconds

## Hook

Show the student asking DEBO to explain before editing.

Voiceover:
"Sometimes the fastest way to ship is to slow down for one minute and understand the code."

## Shot List

| Time | Visual | Voiceover | Onscreen Note |
|---|---|---|---|
| 0:00-0:10 | `debo mentor` command | "Mentor Mode starts with explanation, not modification." | Explain before edit |
| 0:10-0:28 | Code map appears | "DEBO maps the file into human-sized pieces." | Code map |
| 0:28-0:48 | Validation explanation | "The lesson is about API boundaries: reject bad input early and clearly." | API boundary |
| 0:48-1:10 | Quiz interaction | "Then it checks understanding with a small question." | Active recall |
| 1:10-1:30 | Suggested next test | "The student gets a next step they can act on." | Next learning step |

## Video Agent Prompt

Render `snapshots/05-mentor-mode.terminal.md`. Use a calm teaching pace, with slight pauses before student answers. Keep the terminal foreground readable and uncluttered.

## Editor Notes

- This episode should feel more like a tutorial than a sales demo.
- Add a lower-third: "Explain. Quiz. Apply."
- End with the prompt and blinking green cursor.


## Terminal Snapshot

# Snapshot 05: Mentor Mode

```terminal
student@debo:~/campus-labs$ debo mentor src/routes/notes.ts --level beginner
MENTOR MODE
Goal: explain before editing

Code map:
- validateNoteInput checks required fields
- notesRouter.get returns notes
- notesRouter.post creates a note after validation

Important idea:
Validation protects the API boundary. It stops incomplete data before it reaches application logic.

student@debo:~/campus-labs$ debo quiz last-explanation
Question 1:
Why validate request body data before creating a note?

Student answer:
to make sure the data is complete before saving it

DEBO:
Correct. Strong APIs reject bad input early and return clear errors.

Question 2:
What test should we add next?

Suggested answer:
A test for title length or empty body.

student@debo:~/campus-labs$ _
```


## Video Agent Safety

- Use synthetic data only.
- Keep security scenes authorized, scoped, and non-destructive.
- Do not imply deployment or release approval unless the transcript says so.