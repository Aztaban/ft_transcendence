# Project Structure

Monorepo layout for ft_transcendence. Reflects confirmed scope only, no `?` features.

```
ft_transcendence/
├── frontend/                          # React 18 + TypeScript
│   ├── public/
│   ├── src/
│   │   ├── api/                       # API client, endpoint wrappers (per api-plan.md)
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── projects.ts
│   │   │   ├── evaluations.ts
│   │   │   ├── slots.ts
│   │   │   ├── notifications.ts
│   │   │   ├── scInbox.ts
│   │   │   ├── files.ts
│   │   │   ├── search.ts
│   │   │   └── admin.ts
│   │   ├── components/                # Shared/reusable UI components
│   │   ├── features/                  # Feature modules, grouped by role
│   │   │   ├── student/
│   │   │   ├── hitchhiker/
│   │   │   ├── headTutor/
│   │   │   ├── studentCouncil/
│   │   │   └── admin/
│   │   ├── hooks/
│   │   ├── pages/                     # Route-level components
│   │   ├── store/                     # State management
│   │   ├── styles/
│   │   ├── types/                     # Shared TS types/interfaces
│   │   ├── utils/
│   │   ├── websocket/                 # Django Channels client, event handlers
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── backend/                           # Django 5 + DRF + Channels
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── dev.py
│   │   │   └── prod.py
│   │   ├── asgi.py                    # Channels entrypoint
│   │   ├── wsgi.py
│   │   ├── urls.py
│   │   └── celery.py
│   ├── apps/
│   │   ├── users/                     # Auth, roles, profiles
│   │   ├── projects/                  # Projects + Hitchhiker eligibility
│   │   ├── evaluations/               # Evaluation requests, workflow state machine
│   │   ├── slots/                     # Slot claiming
│   │   ├── notifications/
│   │   ├── sc_inbox/                  # Anonymous Student Council inbox
│   │   ├── files/
│   │   ├── search/
│   │   └── administration/
│   ├── requirements.txt
│   ├── manage.py
│   └── Dockerfile
│
├── nginx/
│   └── nginx.conf
│
├── docs/
│   ├── architecture.md
│   ├── decisions.md
│   ├── database-schema.md
│   ├── api-plan.md
│   ├── risks.md
│   ├── project-structure.md
│   └── team/                          # Per-member milestone breakdowns
│       ├── dkolarov/
│       ├── lhusarov/
│       ├── mjusta/
│       ├── lformankov/
│       └── rkravche/
│
├── docker-compose.yml
├── .env.example
└── README.md
```

## Notes

- **`apps/` in backend** map directly to the confirmed API domains in `api-plan.md`. No app exists for unconfirmed (`?`) features like announcements or polls.
- **`features/` in frontend** are grouped by platform role (Student, Hitchhiker, Head Tutor, Student Council, Admin), matching the role-based access model.
- **`sc_inbox`** is its own app/feature to keep the anonymity enforcement (serializer-layer on the backend) isolated and auditable.
- **`websocket/`** on the frontend and **Channels/`asgi.py`** on the backend handle real-time updates (slot claims, notifications).