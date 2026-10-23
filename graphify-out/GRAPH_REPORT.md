# Graph Report - ft_transcendence  (2026-10-23)

## Corpus Check
- 409 files · ~150,939 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 45 file(s) not represented in the graph (top: .css 22, (none) 21, .example 1)

## Summary
- 3297 nodes · 7775 edges · 148 communities (118 shown, 30 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 918 edges (avg confidence: 0.9)
- Token cost: 643,684 input · 14,000 output

## Community Hubs (Navigation)
- Team Backlogs Lenka/Martin
- Frontend Live Refresh (WebSocket)
- History & Eligibility Pages
- Backend Models & Eligibility
- Frontend API Client & Requests
- Team Backlogs Diana/Lada
- App Shell, Roles & Sidebar
- Student Council Backend
- WebSocket Delivery Tests
- Evaluation Request Views
- Login, Register & Auth Context
- Profile, Current User & i18n
- Backend Views & DRF
- Team Work Order & Roman Backlog
- Request API Tests
- Slot Picking UI
- Dashboards & Request Cards
- Eligibility Review UI
- Auth Views & Error Envelope
- Projects API & Seed
- Evaluation Events Publishing
- Backend CI Workflow
- Role Permission Classes
- Frontend Dependencies
- Session & Logout Tests
- Pending Page & Dialogs
- Request Workflow Services
- Confirm Request Tests
- Decline Request Tests
- URL Routing & Auth Tests
- Role Visibility Tests
- Cancel Request Tests
- Release Slot Tests
- 42 OAuth Services
- Tech Stack & Decisions
- API Conventions & Security
- Council Message Views
- Eligibility Review Tests
- Milestone Breakdown Plan
- Product Vision & Modules
- Privacy & Architecture Questions
- Eligibility List Tests
- Django Settings & Celery
- Create Request Page
- WebSocket Auth Tests
- Eligibility Lifecycle Tests
- Agent Rules & Contributing
- Pick Slot Overlap Tests
- Roles & Permission Matrix
- Lifecycle, Jobs & Timeline
- Reference Serializers
- OAuth Profile Tests
- Pick Concurrency Tests
- Database Schema
- Default Role Tests
- Profile Update Tests
- User Model Tests
- Role Assignment Rules Tests
- Risks & Eligibility Decisions
- MVP & Core Evaluation Plan
- OAuth Login Flow Tests
- Registration Tests
- OpenAPI Schema Tests
- Health Endpoint Tests
- Frontend TS Config
- Frontend CI Workflow
- Demo & Notifications Plan
- OAuth Account Linking Tests
- Active Connections Tests
- Eligibility Concurrency Tests
- Pick Slot Tests
- Subject: Web & Project Ideas
- Model Constraint Tests
- Meeting Notes
- Connection Handling Tests
- Project URLs & Health
- OAuth Callback Tests
- Profile API Tests
- Roles & Users Contract
- Docker CI Workflow
- Subject: Requirements & A11y
- Admin Results Tests
- WebSocket Consumer
- Django App Configs
- Login Tests
- OAuth Integration Tests
- Project Detail Tests
- Subject Structure & README
- Register & Session Views
- Subject: Gaming Modules
- User Model
- 42 OAuth Views
- Rate Limit Throttles
- Evaluations Admin
- Rate Limit Tests
- Compose: Database
- Subject: User Mgmt & Data
- Subject: Technical & Security
- User Detail & Me Views
- Compose: Healthchecks
- Auth & OAuth Plan
- Accounts Admin
- HTTP Error Tests
- Compose: Frontend
- API Representations
- Council Inbox Contract
- People Search Plan
- Disconnect & Session End Tests
- Shared Test Fixtures
- Compose: Services & Volumes
- Compose: Backend
- Frontend Node TS Config
- Subject: AI Modules
- API Error Tests
- Compose: Dependencies
- Compose: Celery Beat
- Compose: Celery Worker
- Compose: Nginx
- Security & Admin Plan
- User Manager
- Workflow Delivery Tests
- i18n & Accessibility Plan
- Subject: Team Roles
- Migration Check Test
- Compose: Environment
- Prettier Config
- Subject: DevOps Modules
- Registration Serializer
- Subject: Blockchain Modules
- Nginx Entrypoint

## God Nodes (most connected - your core abstractions)
1. `Role` - 168 edges
2. `Project` - 105 edges
3. `EvaluationRequest` - 105 edges
4. `TutorEligibility` - 85 edges
5. `vitest` - 51 edges
6. `react` - 50 edges
7. `TutorEligibilityRequest` - 46 edges
8. `SCMessage` - 43 edges
9. `EvaluationRequest` - 42 edges
10. `react-router` - 41 edges

## Surprising Connections (you probably didn't know these)
- `Settings modules (config.settings.dev / prod) and env vars` --semantically_similar_to--> `Secrets and configuration (.env, make env random key)`  [INFERRED] [semantically similar]
  backend/README.md → docs/security.md
- `Input validation via explicit DRF serializers` --semantically_similar_to--> `Backend rules (api namespace, error envelope, permission classes, explicit serializer fields)`  [INFERRED] [semantically similar]
  docs/security.md → AGENTS.md
- `Never invent contract elements` --semantically_similar_to--> `Contract change process (PR to api-plan, ask IT Architect)`  [INFERRED] [semantically similar]
  AGENTS.md → docs/api-plan.md
- `Project tech stack (Django 5.1, DRF, Celery, MySQL 8.4, Redis, React 18, Vite, Nginx)` --semantically_similar_to--> `Technology stack table (React+TS, Tailwind, Django+DRF+Channels, MySQL, Redis, Celery, Nginx)`  [INFERRED] [semantically similar]
  AGENTS.md → docs/architecture.md
- `Backend API routing (shared api namespace, reverse('api:<name>'))` --references--> `Architecture (draft, July 2026)`  [AMBIGUOUS]
  CONTRIBUTING.md → docs/architecture.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Evaluation request state machine and its concurrency safeguards** — docs_api_plan_evaluation_lifecycle, docs_database_schema_evaluation_request, docs_database_schema_atomic_conditional_updates, docs_database_schema_eval_check_constraints, docs_database_schema_expiry, docs_api_plan_evaluation_request_endpoints [EXTRACTED 1.00]
- **Frontend-backend contract enforcement chain** — agents_source_of_truth_hierarchy, docs_api_plan_api_plan_md, docs_database_schema_database_schema_md, docs_api_plan_openapi_schema_types, docs_decisions_json_shape_contract, docs_api_plan_contract_change_process [INFERRED 0.85]
- **Older planning docs that contradict the approved contract** — docs_decisions_unique_slot_claim, docs_risks_slot_uniqueness_rule, project_strucure_backend_apps_layout, docs_architecture_repo_structure, docs_risks_other_suggested_times, docs_risks_gdpr_email [INFERRED 0.75]
- **Evaluation request lifecycle (request, pick, confirm, cancel)** — info_preparation_dkolarov_milestone_brekadown_evaluation_request_system, info_preparation_dkolarov_milestone_brekadown_slot_picking, info_preparation_dkolarov_milestone_brekadown_student_confirmation, info_preparation_dkolarov_milestone_brekadown_evaluation_cancellation, info_preparation_dkolarov_milestone_brekadown_evaluation_realtime_events [EXTRACTED 1.00]
- **Product Owner planning document set** — info_preparation_mjusta_project_vision, info_preparation_mjusta_mvp, info_preparation_mjusta_module_selection, info_preparation_mjusta_roles_and_permissions, info_preparation_mjusta_product_experience, info_preparation_mjusta_privacy_requirements [EXTRACTED 1.00]
- **Poll anonymity requirement and open architecture question** — info_preparation_rkravche_architecture_questions_q2_poll_anonymity, info_preparation_mjusta_privacy_requirements_poll_privacy, info_preparation_mjusta_product_experience_polls_experience, info_demo_description_poll_voting_system [INFERRED 0.85]
- **Evaluation request lifecycle: request, slot pick, confirm/decline, cancel** — team_task_breakdown_team_lformankov_03_core_evaluation_system_create_evaluation_request_system, team_task_breakdown_team_lformankov_03_core_evaluation_system_slot_picking_by_hitchhiker, team_task_breakdown_team_lformankov_03_core_evaluation_system_student_confirmation_of_picked_slot, team_task_breakdown_team_lformankov_03_core_evaluation_system_evaluation_cancellation, team_task_breakdown_team_dkolarov_03_core_evaluation_system_evaluation_request_status_lifecycle [EXTRACTED 1.00]
- **Frontend real-time stack under the notifications-only WebSocket rule** — team_task_breakdown_team_lformankov_04_realtime_system_frontend_websocket_client, team_task_breakdown_team_lformankov_04_realtime_system_real_time_ui_integration, team_task_breakdown_team_dkolarov_04_realtime_system_real_time_ui_integration, team_task_breakdown_team_lformankov_05_communication_notifications_integrate_realtime_notifications, team_task_breakdown_team_dkolarov_04_realtime_system_realtime_architecture_rule [INFERRED 0.85]
- **Hitchhiker eligibility gating slot picking** — team_task_breakdown_team_dkolarov_03_core_evaluation_system_hitchhiker_project_eligibility_request, team_task_breakdown_team_lformankov_03_core_evaluation_system_hitchhiker_project_eligibility_request, team_task_breakdown_team_dkolarov_03_core_evaluation_system_eligibility_request_status, team_task_breakdown_team_lformankov_03_core_evaluation_system_slot_picking_by_hitchhiker [EXTRACTED 1.00]
- **Evaluation request lifecycle flow (Lenka)** — team_task_breakdown_team_lhusarov_03_core_evaluation_system_create_evaluation_request_system, team_task_breakdown_team_lhusarov_03_core_evaluation_system_implement_slot_picking_by_hitchhiker, team_task_breakdown_team_lhusarov_03_core_evaluation_system_implement_student_confirmation_of_picked_slot, team_task_breakdown_team_lhusarov_03_core_evaluation_system_implement_evaluation_cancellation, team_task_breakdown_team_lhusarov_03_core_evaluation_system_evaluation_request_status_lifecycle [EXTRACTED 1.00]
- **Notification-triggering workflow events (Lenka)** — team_task_breakdown_team_lhusarov_05_communication_notifications_create_notification_system, team_task_breakdown_team_lhusarov_05_communication_notifications_notification_types, team_task_breakdown_team_lhusarov_03_core_evaluation_system_implement_hitchhiker_project_eligibility_request, team_task_breakdown_team_lhusarov_03_core_evaluation_system_implement_slot_picking_by_hitchhiker, team_task_breakdown_team_lhusarov_03_core_evaluation_system_implement_student_confirmation_of_picked_slot, team_task_breakdown_team_lhusarov_03_core_evaluation_system_implement_evaluation_cancellation [EXTRACTED 1.00]
- **Role-based access control stack (Lenka)** — team_task_breakdown_team_lhusarov_02_authentication_user_management_create_role_system, team_task_breakdown_team_lhusarov_02_authentication_user_management_implement_permission_middleware, team_task_breakdown_team_lhusarov_08_security_administration_complete_role_permission_system, team_task_breakdown_team_lhusarov_08_security_administration_implement_administration_permissions, team_task_breakdown_team_lhusarov_02_authentication_user_management_platform_roles [INFERRED 0.85]
- **Roman's M1 infrastructure foundation** — team_task_breakdown_team_rkravche_01_foundation_infrastructure_setup_nginx_https, team_task_breakdown_team_rkravche_01_foundation_infrastructure_setup_background_task_processing, team_task_breakdown_team_rkravche_01_foundation_infrastructure_setup_docker_development_environment, team_task_breakdown_team_rkravche_01_foundation_infrastructure_initialize_backend_application, team_task_breakdown_team_rkravche_01_foundation_infrastructure_setup_development_tools [EXTRACTED 1.00]
- **M8 role-based security & administration** — team_task_breakdown_team_mjusta_08_security_administration_complete_role_permission_system, team_task_breakdown_team_mjusta_08_security_administration_permission_matrix, team_task_breakdown_team_mjusta_08_security_administration_implement_administration_permissions, team_task_breakdown_team_mjusta_08_security_administration_improve_api_security, team_task_breakdown_team_mjusta_08_security_administration_create_audit_logging_system, team_task_breakdown_team_rkravche_08_security_administration_improve_api_security, team_task_breakdown_team_rkravche_08_security_administration_create_audit_logging_system [INFERRED 0.85]
- **Team handoff chain infra -> backend -> UI -> integration** — team_task_breakdown_team_work_order_handoff_rule, team_task_breakdown_team_readme_roman_rkravche, team_task_breakdown_team_readme_martin_mjusta, team_task_breakdown_team_readme_lenka_lhusarov, team_task_breakdown_team_readme_diana_dkolarov, team_task_breakdown_team_readme_lada_lformankov [EXTRACTED 1.00]
- **Modules Requiring an Implemented Game** — info_en_subject_mod_web_game_major, info_en_subject_mod_ai_opponent_major, info_en_subject_mod_tournament_minor, info_en_subject_mod_game_customization_minor, info_en_subject_mod_spectator_minor, info_en_subject_mod_multiplayer_major, info_en_subject_mod_another_game_major, info_en_subject_mod_game_stats_minor [EXTRACTED 1.00]
- **Pong Example 14-Point Module Set** — info_en_subject_pong_example, info_en_subject_mod_web_game_major, info_en_subject_mod_remote_players_major, info_en_subject_mod_tournament_minor, info_en_subject_mod_game_customization_minor, info_en_subject_mod_standard_user_mgmt_major, info_en_subject_mod_oauth_minor, info_en_subject_mod_frameworks_major, info_en_subject_mod_orm_minor, info_en_subject_mod_ai_opponent_major [EXTRACTED 1.00]
- **General Requirements Whose Failure Rejects the Project** — info_en_subject_web_app_frontend_backend_db, info_en_subject_git_commit_requirement, info_en_subject_containerization_single_command, info_en_subject_chrome_compatibility, info_en_subject_browser_console_clean, info_en_subject_privacy_policy_tos, info_en_subject_multi_user_support [EXTRACTED 1.00]

## Communities (148 total, 30 thin omitted)

### Community 0 - "Team Backlogs Lenka/Martin"
Cohesion: 0.06
Nodes (96): Lada (lformankov), Milestone 8 Security & Administration (Lada), Create Frontend Testing Suite, Milestone 9 Testing & Deployment (Lada), Complete Documentation (frontend integration docs), Improve Final User Experience, Milestone 10 Final Polish & Demo (Lada), Prepare Evaluation Demo (+88 more)

### Community 1 - "Frontend Live Refresh (WebSocket)"
Cohesion: 0.05
Nodes (51): BACK_ONLINE_MS, ConnectionStatus(), connectLoseAndReturn(), renderWithSocket(), loggedIn(), loggedIn(), Probe(), useStudentRequests() (+43 more)

### Community 2 - "History & Eligibility Pages"
Cohesion: 0.04
Nodes (56): createEligibilityRequest(), EvaluationResultFilter, getProject(), listProjects(), EligibilitySentDialog(), EligibilitySentDialogProps, LoadState, projectInitials() (+48 more)

### Community 3 - "Backend Models & Eligibility"
Cohesion: 0.04
Nodes (28): Migration, Migration, Migration, Migration, Migration, Migration, Migration, TimeStampedModel (+20 more)

### Community 4 - "Frontend API Client & Requests"
Cohesion: 0.05
Nodes (58): ApiError, ApiErrorFields, ApiErrorPayload, apiRequest(), getCookie(), getCsrfToken(), UNSAFE_METHODS, cancelEvaluationRequest() (+50 more)

### Community 5 - "Team Backlogs Diana/Lada"
Cohesion: 0.07
Nodes (76): Create Repository Structure & Development Workflow, Diana (dkolarov) - frontend UI & Scrum Master, Initialize Frontend Application (React/TS structure & layout), Milestone 1 (Diana): Project Foundation & Infrastructure, 42 OAuth login, Create Role-Based Frontend Navigation (frontend), Create User Profile System (profile page UI), Implement Authentication System (login page UI) (+68 more)

### Community 6 - "App Shell, Roles & Sidebar"
Cohesion: 0.05
Nodes (45): App(), AuthenticatedApp(), RequestsRoute(), renderAt(), RoleGuard(), RoleGuardProps, BaseLayout(), BaseLayoutProps (+37 more)

### Community 7 - "Student Council Backend"
Cohesion: 0.05
Nodes (49): SCMessage, Meta, api_client(), council(), iso(), make_user(), shown(), test_detail_is_hidden_outside_the_council() (+41 more)

### Community 8 - "WebSocket Delivery Tests"
Cohesion: 0.05
Nodes (30): publish_user_event(), test_redis_layer_delivers_between_instances(), layer(), layer(), socket(), test_failed_event_delivery_does_not_skip_later_commit_callbacks(), test_shared_delivery_snapshots_payload(), test_user_event_reaches_all_recipient_tabs_and_devices_only() (+22 more)

### Community 9 - "Evaluation Request Views"
Cohesion: 0.05
Nodes (23): MeView, test_reference_components_are_shared_and_avatar_urls_are_nullable_strings(), CannotPickOwnRequest, CanPickSlot, CanReleaseSlot, EvaluationRequestPermission, NotEligible, EvaluationRequestCreateSerializer (+15 more)

### Community 10 - "Login, Register & Auth Context"
Cohesion: 0.05
Nodes (45): AuthUser, getSession(), LoginPayload, LoginResponse, loginUser(), logoutUser(), registerUser(), RegistrationPayload (+37 more)

### Community 11 - "Profile, Current User & i18n"
Cohesion: 0.06
Nodes (43): getCurrentUser(), updateCurrentUser(), UpdateUserProfilePayload, LanguageSwitcher(), current, lenka, updateCurrentUserMock, current (+35 more)

### Community 12 - "Backend Views & DRF"
Cohesion: 0.07
Nodes (16): can_assign(), ProfileSerializer, Meta, ProfileUpdateSerializer, Meta, PublicProfileSerializer, Meta, RoleAssignmentResultSerializer (+8 more)

### Community 13 - "Team Work Order & Roman Backlog"
Cohesion: 0.07
Nodes (52): Create People Search API, GET /api/search/people?q=, Milestone 6 - Search & Discovery (Martin), People search result (display_name, avatar_url, role, bio), Milestone 7 - Accessibility & i18n (Martin, placeholder), Complete Role & Permission System, Create Audit Logging System (backend), Implement Administration Permissions (+44 more)

### Community 14 - "Request API Tests"
Cohesion: 0.09
Nodes (48): client(), detail_url(), eligible_tutor(), evaluation(), expected(), fixed_time(), grant(), list_url() (+40 more)

### Community 15 - "Slot Picking UI"
Cohesion: 0.07
Nodes (39): pickSlot(), Choice, ChosenSlot, dayLabel(), SlotFieldErrors, SlotPicker(), update(), SlotPickerProps (+31 more)

### Community 16 - "Dashboards & Request Cards"
Cohesion: 0.07
Nodes (37): AwaitingConfirmation(), AwaitingConfirmationProps, EvaluationHistory(), EvaluationHistoryProps, outcomeLabel(), pastEvaluation(), OpenRequestQueue(), OpenRequestQueueProps (+29 more)

### Community 17 - "Eligibility Review UI"
Cohesion: 0.08
Nodes (32): CreateEligibilityRequestPayload, EligibilityDecision, getTutorEligibility(), listEligibilityRequests(), ListEligibilityRequestsOptions, reviewEligibilityRequest(), ReviewEligibilityRequestPayload, ReviewDialog() (+24 more)

### Community 18 - "Auth Views & Error Envelope"
Cohesion: 0.07
Nodes (18): CsrfEnforcedSessionAuthentication, AuthenticationResultSerializer, LoginSerializer, SessionStatusSerializer, SessionUserSerializer, test_suspension_blocks_default_django_authentication(), _email_conflict_response(), LoginView (+10 more)

### Community 19 - "Projects API & Seed"
Cohesion: 0.08
Nodes (19): Project, Meta, ProjectRefSerializer, Meta, ProjectSerializer, Meta, session_client(), test_project_list_ignores_pagination_parameters() (+11 more)

### Community 20 - "Evaluation Events Publishing"
Cohesion: 0.09
Nodes (23): _eligible_hitchhiker_ids(), EvaluationEvent, publish_cancelled_event(), publish_created_event(), publish_declined_event(), publish_evaluation_event(), publish_released_event(), publish_updated_event() (+15 more)

### Community 21 - "Backend CI Workflow"
Cohesion: 0.05
Nodes (39): defaults, env, runs-on, services, steps, concurrency, cancel-in-progress, group (+31 more)

### Community 22 - "Role Permission Classes"
Cohesion: 0.10
Nodes (20): CanAssignRoles, HasRole, IsAdminRole, IsHeadTutorRole, IsSCMemberRole, IsStudentRole, IsTutorRole, _allowed() (+12 more)

### Community 23 - "Frontend Dependencies"
Cohesion: 0.07
Nodes (35): dependencies, i18next@26.4.2, react@^18.3.1, react-dom@^18.3.1, react-i18next@17.0.15, react-router@^7.18.3, devDependencies, jsdom@^25.0.1 (+27 more)

### Community 24 - "Session & Logout Tests"
Cohesion: 0.12
Nodes (23): create_user(), csrf_client(), group_send(), logged_in_client(), post_logout(), test_anonymous_logout_does_not_schedule_event(), test_anonymous_logout_rejects_invalid_csrf_header(), test_anonymous_logout_still_requires_csrf() (+15 more)

### Community 25 - "Pending Page & Dialogs"
Cohesion: 0.13
Nodes (25): releaseEvaluationRequest(), CancelDialog(), PendingViewer, PreviewDialog(), useDialog(), cancelErrorMessage(), groupByDay(), loadPending() (+17 more)

### Community 26 - "Request Workflow Services"
Cohesion: 0.11
Nodes (17): publish_slot_picked_event(), ActiveRequestExists, create_request(), edit_note(), EvaluationAlreadyStarted, InvalidStateTransition, lock_participants(), person_is_busy() (+9 more)

### Community 27 - "Confirm Request Tests"
Cohesion: 0.12
Nodes (26): confirm_request(), confirm_url(), evaluation(), event_sender(), expected(), fixed_time(), seeded_roles(), session_client() (+18 more)

### Community 28 - "Decline Request Tests"
Cohesion: 0.12
Nodes (25): decline_request(), decline_url(), evaluation(), event_sender(), expected(), fixed_time(), seeded_roles(), session_client() (+17 more)

### Community 30 - "Role Visibility Tests"
Cohesion: 0.15
Nodes (23): Role, Meta, Name, api_client(), expected_roles(), make_user(), test_admin_can_assign_any_role(), test_admin_can_revoke_role() (+15 more)

### Community 31 - "Cancel Request Tests"
Cohesion: 0.15
Nodes (25): cancel_url(), evaluation(), event_sender(), expected(), fixed_time(), seeded_roles(), session_client(), student() (+17 more)

### Community 32 - "Release Slot Tests"
Cohesion: 0.14
Nodes (25): evaluation(), expected(), fixed_time(), release_url(), seeded_roles(), session_client(), student(), test_at_or_after_start_rejected() (+17 more)

### Community 33 - "42 OAuth Services"
Cohesion: 0.12
Nodes (13): OAuth42IdentitySerializer, Meta, OAuth42ProfileSerializer, OAuth42UserCreationSerializer, Meta, _persist_42_identity(), resolve_42_user(), create_user() (+5 more)

### Community 34 - "Tech Stack & Decisions"
Cohesion: 0.09
Nodes (22): Project tech stack (Django 5.1, DRF, Celery, MySQL 8.4, Redis, React 18, Vite, Nginx), argon2-cffi 23.1.0, channels 4.3.2 + channels-redis 4.3.0, daphne 4.2.3, Django 5.1.4 + djangorestframework 3.15.2, drf-spectacular 0.28.0, mysqlclient 2.2.6, backend/requirements.txt (runtime dependencies) (+14 more)

### Community 35 - "API Conventions & Security"
Cohesion: 0.13
Nodes (20): API Plan (frontend-backend contract), Authentication endpoints (§10.1), CSRF X-CSRFToken header on unsafe methods, Error codes table (§5.6), Error envelope {error: {code, message, fields}}, 42 OAuth flow and oauth error codes, Pagination, filtering and ordering conventions, Rate limits (§5.9) (+12 more)

### Community 36 - "Council Message Views"
Cohesion: 0.09
Nodes (11): SCMessageCreatedSerializer, SCMessageCreateSerializer, SCMessageSerializer, Meta, SCMessageUpdateSerializer, _create_sc_message(), _is_council(), _list_sc_messages() (+3 more)

### Community 37 - "Eligibility Review Tests"
Cohesion: 0.21
Nodes (19): api_client(), expected_eligibility_request(), iso(), make_pending(), make_user(), project_ref(), review_url(), test_already_reviewed_returns_409() (+11 more)

### Community 38 - "Milestone Breakdown Plan"
Cohesion: 0.08
Nodes (24): Evaluation Request System (Real-Time), GitHub Milestone & Issue Breakdown, Setup Celery + Redis background tasks, Development tools and CI pipeline, Docker Compose development environment, Prepare Evaluation Demo, Evaluation real-time events (evaluation.slot_picked/confirmed/declined/cancelled), Frontend WebSocket Client (+16 more)

### Community 39 - "Product Vision & Modules"
Cohesion: 0.09
Nodes (21): Public Tutor & Counsellor Profiles, Two-Factor Authentication (TOTP), Module Selection, Module Product Dependencies, Prometheus and Grafana monitoring module (Major, 2), Standard user management module (stretch, Major 2), Two-factor authentication module (stretch, Minor 1), User interaction module (stretch, Major 2) (+13 more)

### Community 40 - "Privacy & Architecture Questions"
Cohesion: 0.09
Nodes (24): Resource Library (File Upload & Management), File upload and management module (Minor, 1), GDPR-related controls module (Minor, 1), Explicitly post-MVP capabilities, Privacy Requirements, Account deletion and anonymization, Consent and preferences, Personal data categories (+16 more)

### Community 41 - "Eligibility List Tests"
Cohesion: 0.17
Nodes (19): api_client(), expected_eligibility_request(), iso(), make_request(), make_user(), project_ref(), test_create_rejects_already_eligible_projects(), test_create_rejects_when_pending_exists() (+11 more)

### Community 43 - "Create Request Page"
Cohesion: 0.12
Nodes (16): createEvaluationRequest(), InfoNotice(), InfoNoticeProps, RequestSuccessDialog(), RequestSuccessDialogProps, CreateRequestPage(), handleSubmit(), Draft (+8 more)

### Community 44 - "WebSocket Auth Tests"
Cohesion: 0.17
Nodes (19): assert_unauthenticated(), connect(), logged_in_client(), memory_channel_layer(), socket(), test_changed_password_invalidates_cookie(), test_expired_session_closes_with_4401(), test_http_login_cookie_authenticates_websocket() (+11 more)

### Community 45 - "Eligibility Lifecycle Tests"
Cohesion: 0.16
Nodes (14): TutorEligibilityRequest, Meta, Status, api_client(), make_user(), test_create_rejects_invalid_project_ids_shape(), test_create_rejects_malformed_project_ids(), test_create_rejects_more_than_50_project_ids() (+6 more)

### Community 46 - "Agent Rules & Contributing"
Cohesion: 0.11
Nodes (14): AGENTS.md (agent instructions), Pre-PR CI commands (ruff, black, isort, pytest, tsc, npm test), black 24.10.0, isort 5.13.2, ruff 0.8.4, pytest 8.3.4 + pytest-django 4.9.0, backend/requirements-dev.txt (dev dependencies), CLAUDE.md (imports AGENTS.md), Branch naming issue-<parent>/<sub>-<desc>, CODEOWNERS automatic reviewer assignment (+6 more)

### Community 47 - "Pick Slot Overlap Tests"
Cohesion: 0.16
Nodes (22): book(), claim(), other_project(), pick_url(), test_cancelled_booking_does_not_block(), test_closed_request_with_overlapping_booking_is_not_pending(), test_eligible_hitchhiker_can_call_the_endpoint(), test_exact_slot_boundaries_are_accepted() (+14 more)

### Community 48 - "Roles & Permission Matrix"
Cohesion: 0.12
Nodes (21): Hitchhiker Project Eligibility Request (PENDING/APPROVED/DECLINED), Product Experience, Administrator workspace, Common authenticated pages, Common UI states (loading, empty, error, denied, conflict, success), Head Tutor workspace, Student Council workspace, Student workspace (+13 more)

### Community 49 - "Lifecycle, Jobs & Timeline"
Cohesion: 0.10
Nodes (15): Celery worker and beat processes, celery 5.4.0, Administration: exceptions list and audit log (§10.9), Evaluation request lifecycle state machine, Override (Head Tutor/Admin acting with reason, audit-logged), Slot rules and overlap checks for pick-slot, Background jobs (expire_evaluation_requests, purge_old_notifications), Evaluation request expiry job (+7 more)

### Community 50 - "Reference Serializers"
Cohesion: 0.13
Nodes (9): UserRefSerializer, test_user_reference_preserves_nullable_relative_avatar_url(), test_user_reference_without_avatar_has_exact_public_fields(), _duration_message(), _grid_message(), _max_lead_message(), _min_lead_message(), _on_slot_grid() (+1 more)

### Community 51 - "OAuth Profile Tests"
Cohesion: 0.15
Nodes (11): retrieve_42_account_information(), client_with_state(), FakeProfileResponse, test_callback_retrieves_profile_and_creates_user(), test_callback_returns_bad_gateway_when_profile_retrieval_fails(), test_retrieve_42_account_information_handles_provider_failure(), test_retrieve_42_account_information_rejects_invalid_profile(), test_retrieve_42_account_information_rejects_malformed_json() (+3 more)

### Community 52 - "Pick Concurrency Tests"
Cohesion: 0.16
Nodes (17): TutorEligibility, Meta, grant(), test_closed_request_cannot_be_picked(), test_eligibility_for_another_project_hides_the_request(), test_eligible_head_tutor_can_pick(), test_eligible_head_tutor_picks(), test_head_tutor_cannot_take_a_picked_request() (+9 more)

### Community 53 - "Database Schema"
Cohesion: 0.20
Nodes (16): EligibilityRequest representation, ProjectRef and Project representations, announcement table (not yet agreed), audit_log table (append-only), Database Schema (MySQL tables and constraints), evaluation_request check constraints (eval_req_*), evaluation_request table, file table (bytes in media volume) (+8 more)

### Community 54 - "Default Role Tests"
Cohesion: 0.13
Nodes (12): UserRole, Meta, test_account_creation_assigns_only_student(), test_backfill_is_idempotent_and_preserves_other_roles(), test_missing_seeded_role_does_not_leave_a_partially_created_account(), student_role(), test_assign_role_and_has_role(), test_revoke_role() (+4 more)

### Community 55 - "Profile Update Tests"
Cohesion: 0.22
Nodes (15): exchange_42_code_for_access_token(), _create_user(), _patch_me(), test_patch_accepts_display_name_at_max_length(), test_patch_changes_only_the_logged_in_user(), test_patch_ignores_non_editable_fields(), test_patch_rejects_invalid_values_without_saving(), test_patch_requires_authentication() (+7 more)

### Community 56 - "User Model Tests"
Cohesion: 0.12
Nodes (10): test_create_superuser_and_reject_invalid_flags(), test_create_user_requires_nonblank_email(), test_create_user_validates_email(), test_display_name_is_required_by_model_validation(), test_email_uniqueness_after_casefolding(), test_intra_id_is_unique_when_provided(), test_intra_login_is_unique_when_provided(), test_language_and_status_choices_are_validated() (+2 more)

### Community 57 - "Role Assignment Rules Tests"
Cohesion: 0.28
Nodes (17): assign(), client_for(), csrf_header(), logged_in_browser(), make_user(), revoke(), test_admin_cannot_revoke_their_own_roles(), test_assign_through_a_session_needs_the_csrf_token() (+9 more)

### Community 58 - "Risks & Eligibility Decisions"
Cohesion: 0.11
Nodes (17): Becoming a Hitchhiker and requesting eligibility, Open decisions: Announcements and Polls, Projects and tutor eligibility endpoints (§10.3), Environments and configuration (.env, self-signed TLS), Polls tables with split ballot/vote (not yet agreed), Risk R4: 42 API secret leak, Risk R6: GDPR requires confirmation emails, Risk R3: 42 Intra API rate limit for tutor sync (+9 more)

### Community 59 - "MVP & Core Evaluation Plan"
Cohesion: 0.14
Nodes (16): Evaluation Cancellation (either party, any time), Evaluation Request System (PENDING, AWAITING_CONFIRMATION, CONFIRMED, CANCELLED), M3 Core Evaluation System, Project Management System, Slot Picking by Hitchhiker, Student Confirmation of Picked Slot, Minimum Viable Product, Optional minimal Student Council announcement board (+8 more)

### Community 60 - "OAuth Login Flow Tests"
Cohesion: 0.19
Nodes (9): assert_frontend_redirect(), client_with_state(), FakeTokenResponse, test_callback_exchanges_code_without_exposing_secrets(), fake_urlopen(), test_callback_handles_token_exchange_failure(), test_callback_rejects_token_response_without_access_token(), test_oauth_redirect_generates_state_and_redirects_to_42() (+1 more)

### Community 61 - "Registration Tests"
Cohesion: 0.20
Nodes (12): assert_validation_error(), registration_payload(), test_anonymous_registration_requires_valid_csrf(), test_register_allows_duplicate_display_name(), test_register_handles_database_uniqueness_race(), test_register_hashes_password_with_argon2(), test_register_rejects_existing_email_case_insensitively(), test_register_rejects_invalid_display_name() (+4 more)

### Community 62 - "OpenAPI Schema Tests"
Cohesion: 0.13
Nodes (6): schema(), test_documented_statuses_and_error_envelopes(), test_multi_value_filters_use_comma_separated_query_encoding(), test_pagination_keys_are_required_even_when_links_are_null(), test_remaining_implemented_operations_document_relevant_errors(), test_transition_schema_takes_no_body_and_returns_evaluation_request()

### Community 63 - "Health Endpoint Tests"
Cohesion: 0.14
Nodes (6): BrokenConnection, DummyConnection, DummyCursor, DummyRedis, test_health_hides_failure_details(), test_health_reports_db_redis_and_celery()

### Community 64 - "Frontend TS Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+10 more)

### Community 65 - "Frontend CI Workflow"
Cohesion: 0.11
Nodes (18): concurrency, cancel-in-progress, group, run, container, defaults, runs-on, steps (+10 more)

### Community 66 - "Demo & Notifications Plan"
Cohesion: 0.11
Nodes (19): Demo Feature to Subject Module Mapping, Analytics Dashboard, Anonymous Student Council Messages, Dark / Light Theme, Figma Demo Prototype, Notification Center, Organizations & Teams (Organization System), Personal Calendar (+11 more)

### Community 67 - "OAuth Account Linking Tests"
Cohesion: 0.38
Nodes (13): account_information(), assert_frontend_redirect(), callback(), client_with_state(), mock_verified_42_identity(), test_account_creation_integrity_error_returns_conflict_without_login(), test_authenticated_password_user_is_not_linked_by_oauth_login(), test_authenticated_user_with_same_email_is_not_auto_linked() (+5 more)

### Community 68 - "Active Connections Tests"
Cohesion: 0.24
Nodes (13): layer(), members(), socket(), test_connection_joins_exactly_two_groups_and_leaves_on_disconnect(), connect(), test_failed_second_join_removes_first_membership(), connect(), test_reconnect_replaces_old_channel_membership() (+5 more)

### Community 69 - "Eligibility Concurrency Tests"
Cohesion: 0.14
Nodes (6): actors(), browser_for(), compete(), test_competing_reviews_have_one_winner_and_consistent_grants(), test_competing_submissions_create_only_one_pending_request(), test_failed_grant_creation_rolls_back_review_and_partial_grants()

### Community 70 - "Pick Slot Tests"
Cohesion: 0.17
Nodes (13): evaluation(), event_sender(), expected(), fixed_time(), hitchhiker(), logged_in_client(), project(), seeded_roles() (+5 more)

### Community 71 - "Subject: Web & Project Ideas"
Cohesion: 0.15
Nodes (18): Booking System Project Idea, Learning Management System Project Idea, Minor: Advanced Chat Features, Major: Advanced Permissions System (roles, CRUD), Minor: Advanced Search (filters, sorting, pagination), Minor: Backend Framework, Minor: Custom Design System (10+ components), Minor: File Upload and Management (+10 more)

### Community 72 - "Model Constraint Tests"
Cohesion: 0.20
Nodes (12): assert_rejected(), people(), project(), test_a_tutor_is_eligible_for_a_project_only_once(), test_consistent_requests_are_accepted(), test_eligibility_request_lists_each_project_once(), test_eligibility_review_fields_follow_the_status(), test_inconsistent_requests_are_rejected_by_the_database() (+4 more)

### Community 73 - "Meeting Notes"
Cohesion: 0.18
Nodes (17): First Meeting Notes (17.7.2026), Action: Prepare architecture, API plan, DB schema, risks (rkravche, 31.7.2026), Action: Divide project into milestones and GitHub issues (dkolarov, 7.8.2026), Action: Prepare project vision documents (mjusta, 24.7.2026), IT Architect: Roman Kravchenko (rkravche), Product Owner: Martin Justa (mjusta), Scrum Master: Diana Kolarova (dkolarov), Team Role Division (PO, IT Architect, Scrum Master, Developers) (+9 more)

### Community 74 - "Connection Handling Tests"
Cohesion: 0.23
Nodes (11): active_user(), memory_channel_layer(), socket(), test_active_session_connects_without_unsolicited_messages(), connect(), test_client_messages_are_ignored(), connect(), test_invalid_scope_accepts_then_closes_with_4401() (+3 more)

### Community 76 - "OAuth Callback Tests"
Cohesion: 0.30
Nodes (9): assert_frontend_redirect(), callback(), client_with_state(), test_callback_accepts_valid_state_and_code_and_creates_session(), test_callback_handles_provider_error_without_echoing_description(), test_callback_rejects_missing_code_after_valid_state(), test_callback_rejects_missing_or_mismatched_state_without_consuming_valid_state(), test_callback_rejects_non_ascii_session_state() (+1 more)

### Community 77 - "Profile API Tests"
Cohesion: 0.26
Nodes (9): assert_me_ok(), _create_user(), expected_profile(), test_me_exposes_intra_login_when_linked(), test_me_rejects_unsupported_methods(), test_me_returns_200_and_full_profile_body(), test_me_returns_configured_language(), test_me_returns_current_user_among_many() (+1 more)

### Community 78 - "Roles & Users Contract"
Cohesion: 0.17
Nodes (13): backend/README.md (Django backend setup), apps.accounts.permissions classes (HasRole, IsAdminRole, IsTutorRole, IsHeadTutorRole, IsSCMemberRole, CanAssignRoles), Settings modules (config.settings.dev / prod) and env vars, AdminUser representation, Me representation, People search endpoint (§10.8), PublicUser representation, Role representation (+5 more)

### Community 79 - "Docker CI Workflow"
Cohesion: 0.13
Nodes (14): concurrency, cancel-in-progress, group, runs-on, steps, jobs, docker, name (+6 more)

### Community 80 - "Subject: Requirements & A11y"
Cohesion: 0.13
Nodes (15): Accessibility and Internationalization (IV.2), No Warnings or Errors in Browser Console, Latest Stable Google Chrome Compatibility, Containerized Deployment Run with a Single Command, General Requirements (III.2), Git Commits from All Members with Clear Messages, Minor: Support for Additional Browsers, Minor: Multiple Languages (3+, i18n, switcher) (+7 more)

### Community 81 - "Admin Results Tests"
Cohesion: 0.25
Nodes (10): browser(), evaluation(), submit(), test_admin_accepts_blank_result_fields_for_unfinished_evaluation(), test_admin_can_correct_or_clear_existing_results(), test_admin_does_not_require_a_result_when_recording_other_fields(), test_admin_rejects_all_populated_fields_and_ignores_forged_lifecycle_fields(), test_admin_rejects_result_fields_before_completion() (+2 more)

### Community 83 - "Django App Configs"
Cohesion: 0.15
Nodes (4): AccountsConfig, CoreConfig, CouncilConfig, EvaluationsConfig

### Community 84 - "Login Tests"
Cohesion: 0.37
Nodes (9): create_user(), csrf_client(), post_login(), test_login_creates_persistent_django_session(), test_login_rejects_invalid_credentials_without_creating_session(), test_login_rejects_missing_or_invalid_csrf_header(), test_login_rejects_post_without_csrf_even_for_anonymous_user(), test_login_rejects_suspended_user() (+1 more)

### Community 85 - "OAuth Integration Tests"
Cohesion: 0.17
Nodes (3): ProviderResponse, test_oauth_login_restores_session_and_logs_out_with_csrf(), provider()

### Community 86 - "Project Detail Tests"
Cohesion: 0.21
Nodes (6): create_tutor(), project(), session_client(), test_project_detail_filters_sorts_and_deduplicates_tutors(), test_project_detail_hides_unknown_and_inactive_projects(), test_project_detail_reflects_eligibility_changes()

### Community 87 - "Subject Structure & README"
Cohesion: 0.24
Nodes (12): Bonus Part (Chapter VII, max 5 points), ft_transcendence Subject (v21.1), Mandatory Part (Chapter III), Module Dependencies and Evaluation Rules, 14-Point Module Requirement (Major=2, Minor=1), Modules (Chapter IV), Modules of Choice (IV.10), README Resources Section with AI Usage Description (+4 more)

### Community 88 - "Register & Session Views"
Cohesion: 0.21
Nodes (3): _has_unique_email_error(), register(), session_status()

### Community 89 - "Subject: Gaming Modules"
Cohesion: 0.30
Nodes (12): Gaming and User Experience (IV.6), Major: Advanced 3D Graphics (Three.js/Babylon.js), Major: AI Opponent for Games, Major: Another Game with History and Matchmaking, Minor: Game Customization Options, Minor: Gamification System, Major: Multiplayer Game (3+ players), Major: Remote Players (+4 more)

### Community 90 - "User Model"
Cohesion: 0.18
Nodes (4): User, Language, Meta, Status

### Community 91 - "42 OAuth Views"
Cohesion: 0.29
Nodes (4): oauth_42_callback(), _oauth_42_frontend_redirect(), _oauth_42_is_configured(), oauth_42_redirect()

### Community 93 - "Evaluations Admin"
Cohesion: 0.18
Nodes (7): EligibilityRequestProjectInline, EvaluationRequestAdmin, EvaluationRequestAdminForm, Meta, ProjectAdmin, TutorEligibilityAdmin, TutorEligibilityRequestAdmin

### Community 94 - "Rate Limit Tests"
Cohesion: 0.35
Nodes (7): assert_throttled(), post_login(), test_a_forged_forwarded_for_does_not_reset_the_limit(), test_login_allows_10_attempts_per_minute(), test_login_and_register_share_the_limit(), test_register_allows_10_attempts_per_minute(), test_the_limit_is_per_client_ip_behind_nginx()

### Community 95 - "Compose: Database"
Cohesion: 0.18
Nodes (11): environment, image, networks, ports, restart, volumes, MYSQL_DATABASE, MYSQL_PASSWORD (+3 more)

### Community 96 - "Subject: User Mgmt & Data"
Cohesion: 0.20
Nodes (11): Basic User Management (email + hashed/salted password), Data and Analytics (IV.8), Minor: Two-Factor Authentication, Major: Advanced Analytics Dashboard, Minor: Data Export and Import, Minor: Game Statistics and Match History, Minor: GDPR Compliance Features, Minor: Remote Authentication with OAuth 2.0 (+3 more)

### Community 97 - "Subject: Technical & Security"
Cohesion: 0.18
Nodes (11): Database with Clear Schema and Relations, CSS Framework or Styling Solution, Cybersecurity (IV.5), Credentials in Git-ignored .env plus .env.example, Form Validation in Frontend and Backend, Framework Definition, HTTPS for All Backend Connections, Major: Framework for Frontend and Backend (+3 more)

### Community 99 - "Compose: Healthchecks"
Cohesion: 0.27
Nodes (10): healthcheck, interval, retries, test, timeout, healthcheck, image, networks (+2 more)

### Community 100 - "Auth & OAuth Plan"
Cohesion: 0.20
Nodes (9): Login with 42 (OAuth 2.0 Remote Authentication), M2 Authentication & User Management, Implement 42 OAuth Authentication, Permission Middleware, Role System (Student, Tutor, Head Tutor, Student Council, Admin), User Registration (password hashing), Remote authentication with 42 module (Minor, 1), Shared application shell (top bar, left nav, main, footer) (+1 more)

### Community 101 - "Accounts Admin"
Cohesion: 0.22
Nodes (4): RoleAdmin, UserAdmin, UserRoleAdmin, UserRoleInline

### Community 102 - "HTTP Error Tests"
Cohesion: 0.22
Nodes (3): authenticated_client(), test_malformed_json_returns_validation_error(), test_unsupported_content_type_returns_415()

### Community 103 - "Compose: Frontend"
Cohesion: 0.22
Nodes (9): build, command, depends_on, env_file, networks, ports, restart, volumes (+1 more)

### Community 104 - "API Representations"
Cohesion: 0.22
Nodes (7): Evaluation request endpoints (§10.4), EvaluationRequest representation and visibility rules, File representation, Files endpoints (§10.7), Notification representation and types (§8.8), Notifications endpoints (§10.5), UserRef representation

### Community 105 - "Council Inbox Contract"
Cohesion: 0.22
Nodes (8): Student Council inbox workflow (anonymous sender, admin reveal), Student Council inbox endpoints incl. reveal-sender (§10.6), SCMessage representation (no sender), Monorepo structure (apps accounts, evaluations, notifications, council, files; infra), Risk R2: SC message sender unmask must be locked down, Planned backend apps (users, projects, evaluations, slots, sc_inbox, files, search, administration), Frontend features grouped by role (student, hitchhiker, headTutor, studentCouncil, admin), Project_strucure.md (planned monorepo layout)

### Community 106 - "People Search Plan"
Cohesion: 0.25
Nodes (9): Search System (Advanced Search backup), M6 Search & Discovery System, People Search API (Hitchhikers + Student Council), People Search Interface, User Discovery Profile View, Advanced search module (Minor, 1), Profile privacy tiers (public/authenticated/private), Search privacy (+1 more)

### Community 107 - "Disconnect & Session End Tests"
Cohesion: 0.36
Nodes (7): socket(), test_client_disconnect_cleans_groups_and_stops_consumer(), connect(), test_repeated_session_ended_does_not_send_after_close(), connect(), test_session_ended_notifies_before_closing_only_target_connections(), connect()

### Community 109 - "Compose: Services & Volumes"
Cohesion: 0.25
Nodes (7): networks, transcendence_net, services, volumes, frontend_node_modules, mysql_data, nginx_certs

### Community 110 - "Compose: Backend"
Cohesion: 0.25
Nodes (8): build, command, env_file, networks, ports, restart, volumes, backend

### Community 111 - "Frontend Node TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, allowImportingTsExtensions, composite, module, moduleResolution, skipLibCheck, include

### Community 112 - "Subject: AI Modules"
Cohesion: 0.25
Nodes (8): Artificial Intelligence (IV.4), Minor: Content Moderation AI, Minor: Image Recognition and Tagging, Major: LLM System Interface, Major: RAG System, Major: ML Recommendation System, Minor: Sentiment Analysis, Minor: Voice/Speech Integration

### Community 114 - "Compose: Dependencies"
Cohesion: 0.38
Nodes (7): depends_on, depends_on, depends_on, condition, db, redis, condition

### Community 115 - "Compose: Celery Beat"
Cohesion: 0.29
Nodes (7): build, command, env_file, networks, restart, volumes, celery_beat

### Community 116 - "Compose: Celery Worker"
Cohesion: 0.29
Nodes (7): build, command, env_file, networks, restart, volumes, celery_worker

### Community 117 - "Compose: Nginx"
Cohesion: 0.29
Nodes (7): build, depends_on, networks, ports, restart, volumes, nginx

### Community 118 - "Security & Admin Plan"
Cohesion: 0.29
Nodes (7): Advanced Permissions System (incl. Counsellors role), Counsellor Role, Improve API Security (rate limiting, headers, sessions), Audit Logging System, M8 Security & Administration, Advanced permissions module (Major, 2), Administrative access and audit

### Community 120 - "Workflow Delivery Tests"
Cohesion: 0.47
Nodes (5): socket(), test_http_action_delivers_only_to_affected_authenticated_connections(), assert_committed_state(), exercise(), perform_action()

### Community 121 - "i18n & Accessibility Plan"
Cohesion: 0.33
Nodes (6): Multi-Language Support, Internationalization framework (EN, CS, ES), M7 Accessibility & Internationalization, WCAG Accessibility Improvements, Multiple languages module (Minor, 1), Accessibility expectations

### Community 122 - "Subject: Team Roles"
Cohesion: 0.33
Nodes (5): Developers (all team members), Product Owner (PO), Project Manager / Scrum Master, Required Team Roles, Technical Lead / Architect

### Community 124 - "Compose: Environment"
Cohesion: 0.60
Nodes (5): environment, environment, environment, MYSQL_HOST, REDIS_URL

### Community 125 - "Prettier Config"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 126 - "Subject: DevOps Modules"
Cohesion: 0.50
Nodes (5): Devops (IV.7), Major: ELK Log Management, Minor: Health Check, Status Page, Backups, Disaster Recovery, Major: Backend as Microservices, Major: Monitoring with Prometheus and Grafana

### Community 128 - "Subject: Blockchain Modules"
Cohesion: 0.50
Nodes (4): Blockchain (IV.9), Major: Tournament Scores on Blockchain (Avalanche/Solidity), Minor: ICP Blockchain Backend, Minor: Server-Side Rendering

## Ambiguous Edges - Review These
- `Backend API routing (shared api namespace, reverse('api:<name>'))` → `Architecture (draft, July 2026)`  [AMBIGUOUS]
  CONTRIBUTING.md · relation: references
- `Planned backend apps (users, projects, evaluations, slots, sc_inbox, files, search, administration)` → `R2 One evaluation_request resource covers whole lifecycle`  [AMBIGUOUS]
  Project_strucure.md · relation: conceptually_related_to
- `backend/README.md (Django backend setup)` → `Users, roles, admin user management endpoints (§10.2)`  [AMBIGUOUS]
  backend/README.md · relation: conceptually_related_to
- `R1 Tutor eligibility is fully manual (no 42 Intra sync)` → `Risk R3: 42 Intra API rate limit for tutor sync`  [AMBIGUOUS]
  docs/risks.md · relation: conceptually_related_to
- `R1 Tutor eligibility is fully manual (no 42 Intra sync)` → `Risk R5: Undefined tutor qualification rule`  [AMBIGUOUS]
  docs/risks.md · relation: conceptually_related_to
- `R3 Concurrency via atomic conditional updates, not unique index` → `Decision 4: DB uniqueness rule prevents double slot claim`  [AMBIGUOUS]
  docs/decisions.md · relation: conceptually_related_to
- `R12 GDPR module out of scope (no export, deletion, email)` → `Monorepo structure (apps accounts, evaluations, notifications, council, files; infra)`  [AMBIGUOUS]
  docs/architecture.md · relation: conceptually_related_to
- `R12 GDPR module out of scope (no export, deletion, email)` → `Risk R6: GDPR requires confirmation emails`  [AMBIGUOUS]
  docs/risks.md · relation: conceptually_related_to
- `R16 Students do not offer slots; Hitchhiker proposes one` → `Risk R9: Fate of student's other suggested times`  [AMBIGUOUS]
  docs/risks.md · relation: conceptually_related_to
- `Technology stack table (React+TS, Tailwind, Django+DRF+Channels, MySQL, Redis, Celery, Nginx)` → `Risk R10: Tailwind vs plain CSS undecided`  [AMBIGUOUS]
  docs/risks.md · relation: conceptually_related_to
- `Counsellor Role` → `Student Council member role`  [AMBIGUOUS]
  Info/Preparation/mjusta/roles-and-permissions.md · relation: conceptually_related_to
- `GET /api/search/people?q=` → `Permission matrix (Student, Hitchhiker/Tutor, Head Tutor, Student Council, Admin)`  [AMBIGUOUS]
  team_task_breakdown/team/mjusta/06_search_discovery.md · relation: conceptually_related_to

## Knowledge Gaps
- **100 isolated node(s):** `CLAUDE.md (imports AGENTS.md)`, `Definition of Done (sub-issue, parent issue, milestone)`, `Phase 2: Testing & bug-fixing M9-M10 (Nov 1 - Nov 15)`, `Django 5.1.4 + djangorestframework 3.15.2`, `mysqlclient 2.2.6` (+95 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 998 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Role` connect `Role Visibility Tests` to `Backend Models & Eligibility`, `Student Council Backend`, `WebSocket Delivery Tests`, `Backend Views & DRF`, `Request API Tests`, `Projects API & Seed`, `Evaluation Events Publishing`, `Role Permission Classes`, `Session & Logout Tests`, `Request Workflow Services`, `Confirm Request Tests`, `Decline Request Tests`, `Cancel Request Tests`, `Release Slot Tests`, `Eligibility Review Tests`, `Eligibility List Tests`, `WebSocket Auth Tests`, `Eligibility Lifecycle Tests`, `Pick Concurrency Tests`, `Default Role Tests`, `Role Assignment Rules Tests`, `Eligibility Concurrency Tests`, `Pick Slot Tests`, `Profile API Tests`, `OAuth Integration Tests`, `Project Detail Tests`, `Accounts Admin`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 127 inferred relationships involving `Role` (e.g. with `CanAssignRoles` and `IsAdminRole`) actually correct?**
  _`Role` has 127 INFERRED edges - model-reasoned connections that need verification._
- **What connects `CLAUDE.md (imports AGENTS.md)`, `Definition of Done (sub-issue, parent issue, milestone)`, `Phase 2: Testing & bug-fixing M9-M10 (Nov 1 - Nov 15)` to the rest of the system?**
  _100 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Team Backlogs Lenka/Martin` be split into smaller, more focused modules?**
  _Cohesion score 0.061721611721611724 - nodes in this community are weakly interconnected._
- **Why does `EvaluationRequest` connect `Evaluation Events Publishing` to `Release Slot Tests`, `Backend Models & Eligibility`, `HTTP Error Tests`, `Pick Slot Tests`, `WebSocket Delivery Tests`, `Evaluation Request Views`, `Model Constraint Tests`, `Request API Tests`, `Pick Slot Overlap Tests`, `Admin Results Tests`, `Reference Serializers`, `Pick Concurrency Tests`, `Workflow Delivery Tests`, `Request Workflow Services`, `Confirm Request Tests`, `Decline Request Tests`, `Evaluations Admin`, `Cancel Request Tests`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Backend API routing (shared api namespace, reverse('api:<name>'))` and `Architecture (draft, July 2026)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Planned backend apps (users, projects, evaluations, slots, sc_inbox, files, search, administration)` and `R2 One evaluation_request resource covers whole lifecycle`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._