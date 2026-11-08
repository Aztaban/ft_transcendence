# The decisions, in plain language

**Owner:** rkravche

---

### 1. React (frontend) + Django (backend)

The subject lists both by name as allowed frameworks, and using a framework on *both* sides is worth 2 points instead of 1. Django also includes login, password hashing and the database layer, so we don't build them ourselves.

### 2. MySQL as the database

I know MySQL well.

### 3. Sessions, not tokens, for staying logged in

When an admin removes someone's Tutor role, it takes effect on their very next click. With tokens they'd keep their access until the token expired.

### 4. Two tutors can never pick the same request

Picking is one database update that only succeeds while the request is still `pending`. When two tutors press "pick" at the same moment, the database lets exactly one of them through; the other gets a clear "someone else was faster" (schema §4.2).

### 5. Real-time updates

The browser keeps one connection open to the server. When something happens, the server pushes a message down it and the page updates without a refresh.

The important part: **the database is the truth, the connection is only speed.** If it drops, the page just reloads its data over normal HTTP.

### 6. Notifications are stored as data, not as sentences

We store *what happened* plus the details, not a finished English sentence. The text is written on screen at the moment it's displayed.

### 7. No file uploads

Avatars and tutor resources were planned and then dropped (R19 in the API plan). Nothing is uploaded or stored as a file, and profiles show the person's initials.

### 8. Background jobs (Celery)

Some work has no user at all: a clock decides it's time to expire old requests or delete old notifications (schema §9).

### 9. How frontend and backend agree

They never call each other's code. They agree on a **shape of JSON**, written down once in the API Plan (§8). The frontend's TypeScript types copy it field for field and are checked in review; generating them from the OpenAPI schema and failing CI on drift is the goal (api-plan §5.10).

### 10. One command to start everything

Docker Compose, wrapped in `make up`. The subject requires the whole system to start with a single command.
