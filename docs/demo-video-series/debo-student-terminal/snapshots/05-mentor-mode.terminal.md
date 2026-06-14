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
