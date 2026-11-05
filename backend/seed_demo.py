"""Lived-in demo data for manual testing.

Run from the repository root, with the stack up and migrations applied:

    docker compose exec -T backend python manage.py shell < backend/seed_demo.py

Every account uses the password Hitchhiker-42! and an @seed.demo email.
Running the script again replaces only those accounts, in one transaction.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone as dt_timezone

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.fields import DateTimeField

from apps.accounts.models import Role, User
from apps.council.models import SCMessage
from apps.evaluations.models import (
    EvaluationRequest,
    Project,
    TutorEligibility,
    TutorEligibilityRequest,
)
from apps.notifications.models import Notification

DOMAIN = "seed.demo"
PASSWORD = "Hitchhiker-42!"
SLOT = timedelta(minutes=45)
ISO = DateTimeField(default_timezone=dt_timezone.utc)

PROJECT_SLUGS = (
    "born2beroot",
    "push_swap",
    "minishell",
    "cpp09",
    "codexion",
    "fly-in",
    "rag-against-the-machine",
    "the-answer-protocol",
    "agent-smith",
)

# login, display name, kind, extra roles besides student
PEOPLE = (
    ("new01", "Ada Novak", "new", ()),
    ("new02", "Ben Horak", "new", ()),
    ("new03", "Cira Malik", "new", ()),
    ("new04", "Dan Svoboda", "new", ()),
    ("new05", "Eva Rossi", "new", ()),
    ("done01", "Filip Cerny", "done", ()),
    ("done02", "Greta Novotna", "done", ()),
    ("done03", "Hugo Benes", "done", ()),
    ("done04", "Iva Kralova", "done", ()),
    ("done05", "Jan Polak", "done", ()),
    ("done06", "Klara Vesela", "done", ()),
    ("done07", "Leo Marek", "done", ()),
    ("done08", "Mia Dvorak", "done", ()),
    ("done09", "Nils Havel", "done", ()),
    ("done10", "Olga Prochazka", "done", ()),
    ("student01", "Petra Kovar", "active", ()),
    ("student02", "Quinn Navarro", "active", ()),
    ("student03", "Rosa Fiala", "active", ()),
    ("student04", "Sam Urban", "active", ()),
    ("student05", "Tereza Blaha", "active", ()),
    ("student06", "Uma Lind", "active", ()),
    ("student07", "Viktor Sevcik", "active", ()),
    ("student08", "Wera Nowak", "active", ()),
    ("student09", "Xenia Moravec", "active", ()),
    ("student10", "Yara Sedlak", "active", ()),
    ("student11", "Adam Ruzicka", "active", ()),
    ("student12", "Bara Kolar", "active", ()),
    ("student13", "Cyril Nemecek", "active", ()),
    ("student14", "Dora Holub", "active", ()),
    ("student15", "Emil Vasquez", "active", ()),
    ("student16", "Freya Soukup", "active", ()),
    ("student17", "Gustav Rezek", "active", ()),
    ("student18", "Hana Barta", "active", ()),
    ("student19", "Ivan Kratochvil", "active", ()),
    ("student20", "Jitka Mala", "active", ()),
    ("hitchhiker01", "Karel Dolezal", "tutor", ("tutor",)),
    ("hitchhiker02", "Lena Horvath", "tutor", ("tutor",)),
    ("hitchhiker03", "Marek Zeman", "tutor", ("tutor",)),
    ("hitchhiker04", "Nina Pospichal", "tutor", ("tutor",)),
    ("hitchhiker05", "Oscar Kucera", "tutor", ("tutor",)),
    ("hitchhiker06", "Pavla Sediva", "tutor", ("tutor",)),
    ("hitchhiker07", "Roman Elias", "tutor", ("tutor",)),
    ("hitchhiker08", "Sara Vlkova", "tutor", ("tutor",)),
    ("hitchhiker09", "Tomas Hajek", "tutor", ("tutor",)),
    ("hitchhiker10", "Ursula Kadlec", "tutor", ("tutor",)),
    ("head01", "Vera Skala", "head", ("head_tutor",)),
    ("head02", "Walter Nemec", "head", ("head_tutor",)),
    ("council01", "Yasmin Broz", "council", ("sc_member",)),
    ("council02", "Zora Hruba", "council", ("sc_member", "tutor")),
    ("admin", "Alex Berg", "admin", ("admin",)),
)

GRANTS = {
    "hitchhiker01": ("born2beroot", "push_swap", "minishell"),
    "hitchhiker02": ("push_swap", "minishell", "cpp09"),
    "hitchhiker03": ("cpp09", "codexion", "fly-in"),
    "hitchhiker04": ("codexion", "fly-in", "rag-against-the-machine"),
    "hitchhiker05": ("rag-against-the-machine", "the-answer-protocol", "agent-smith"),
    "hitchhiker06": ("born2beroot", "the-answer-protocol", "agent-smith"),
    "hitchhiker07": ("minishell", "fly-in", "agent-smith", "cpp09"),
    "hitchhiker08": ("born2beroot", "cpp09", "rag-against-the-machine"),
    "head01": PROJECT_SLUGS,
    "head02": ("born2beroot", "codexion", "agent-smith"),
    "council02": ("born2beroot", "push_swap"),
}

PASSED_FEEDBACK = "Clear walkthrough of the mandatory part. Passed."
FAILED_FEEDBACK = "The edge cases we tried did not pass. Worth another attempt."

USERS = {}
PROJECTS = {}
ROLES = {}
ACTIVE_PAIRS = set()
BUSY = defaultdict(list)
PAST_DAY = 8
ELIGIBILITY = {}


def at(days_from_today, hour, minute=0):
    day = (timezone.now() + timedelta(days=days_from_today)).date()
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=dt_timezone.utc)


def iso(value):
    return ISO.to_representation(value)


def pref(project):
    return {"id": project.id, "slug": project.slug, "name": project.name}


def uref(user):
    return {"id": user.id, "display_name": user.display_name}


def take_past_slot():
    global PAST_DAY
    start = at(-PAST_DAY, 10)
    PAST_DAY += 1
    return start, start + SLOT


def slot_bounds(slot):
    if slot is None:
        return None, None
    if slot[0] == "past":
        return take_past_slot()
    start = at(slot[1], slot[2])
    return start, start + SLOT


def load_catalog():
    missing_roles = {"student", "tutor", "head_tutor", "sc_member", "admin"} - set(
        Role.objects.values_list("name", flat=True)
    )
    if missing_roles:
        raise RuntimeError(f"Missing roles {sorted(missing_roles)}. Run migrations first.")
    ROLES.update({role.name: role for role in Role.objects.all()})
    for slug in PROJECT_SLUGS:
        try:
            PROJECTS[slug] = Project.objects.get(slug=slug, is_active=True)
        except Project.DoesNotExist as exc:
            raise RuntimeError(f"Active project {slug!r} is missing. Run migrations first.") from exc


def remove_previous_seed():
    seed_users = User.objects.filter(email__endswith=f"@{DOMAIN}")
    removed = seed_users.count()
    if removed == 0:
        print("No previous @seed.demo accounts.")
        return
    EvaluationRequest.objects.filter(
        Q(student__in=seed_users) | Q(picked_by__in=seed_users) | Q(cancelled_by__in=seed_users)
    ).delete()
    TutorEligibilityRequest.objects.filter(requester__in=seed_users).delete()
    SCMessage.objects.filter(sender__in=seed_users).delete()
    Notification.objects.filter(recipient__in=seed_users).delete()
    seed_users.delete()
    print(f"Replacing {removed} previous @seed.demo accounts.")


def make_users(password_hash):
    if len(PEOPLE) != 50:
        raise RuntimeError(f"Expected 50 people, got {len(PEOPLE)}.")
    for index, (login, name, kind, extra_roles) in enumerate(PEOPLE, start=1):
        user = User(
            email=f"{login}@{DOMAIN}",
            display_name=name,
            intra_id=900_000_000 + index,
            intra_login=login,
            language=User.Language.ENGLISH,
            status=User.Status.ACTIVE,
            is_staff=kind == "admin",
            is_superuser=kind == "admin",
            password=password_hash,
        )
        user.save()
        user.roles.add(ROLES["student"], *[ROLES[role_name] for role_name in extra_roles])
        if kind == "new":
            created = timezone.now() - timedelta(hours=index)
            last_login = None
        else:
            created = timezone.now() - timedelta(days=200)
            last_login = timezone.now() - timedelta(days=index % 5, hours=3)
        User.objects.filter(pk=user.pk).update(
            created_at=created, updated_at=created, last_login=last_login
        )
        user.refresh_from_db()
        USERS[login] = user


def grant(login, slugs, *, status, reviewer=None, reviewed_at=None, note="", created_at):
    requester = USERS[login]
    request = TutorEligibilityRequest.objects.create(
        requester=requester,
        status=status,
        reviewed_by=reviewer,
        reviewed_at=reviewed_at,
        review_note=note,
    )
    chosen = [PROJECTS[slug] for slug in slugs]
    request.projects.set(chosen)
    TutorEligibilityRequest.objects.filter(pk=request.pk).update(
        created_at=created_at, updated_at=reviewed_at or created_at
    )
    if status == TutorEligibilityRequest.Status.APPROVED:
        TutorEligibility.objects.bulk_create(
            [
                TutorEligibility(tutor=requester, project=project, granted_by_request=request)
                for project in chosen
            ]
        )
        TutorEligibility.objects.filter(granted_by_request=request).update(
            created_at=reviewed_at, updated_at=reviewed_at
        )
    request.refresh_from_db()
    return request


def seed_eligibility():
    now = timezone.now()
    for index, (login, slugs) in enumerate(GRANTS.items()):
        reviewer = USERS["head02"] if login == "head01" else USERS["head01"]
        reviewed_at = now - timedelta(days=30 + index)
        ELIGIBILITY[login] = grant(
            login,
            slugs,
            status=TutorEligibilityRequest.Status.APPROVED,
            reviewer=reviewer,
            reviewed_at=reviewed_at,
            note="Approved for these projects.",
            created_at=reviewed_at - timedelta(days=2),
        )
    # Revoke one project after approval: the request still lists it, the grant is gone.
    TutorEligibility.objects.filter(
        tutor=USERS["hitchhiker07"], project=PROJECTS["cpp09"]
    ).delete()
    declined_at = now - timedelta(days=50)
    ELIGIBILITY["hitchhiker08_declined"] = grant(
        "hitchhiker08",
        ("agent-smith",),
        status=TutorEligibilityRequest.Status.DECLINED,
        reviewer=USERS["head02"],
        reviewed_at=declined_at,
        note="Pass the project once, then ask again.",
        created_at=declined_at - timedelta(days=1),
    )
    ELIGIBILITY["hitchhiker09"] = grant(
        "hitchhiker09",
        ("push_swap", "codexion", "the-answer-protocol"),
        status=TutorEligibilityRequest.Status.PENDING,
        created_at=now - timedelta(days=1),
    )


def picker_for(project, student, salt):
    tutors = [
        row.tutor
        for row in TutorEligibility.objects.filter(project=project)
        .exclude(tutor=student)
        .select_related("tutor")
        .order_by("tutor_id")
    ]
    if not tutors:
        raise RuntimeError(f"No Hitchhiker is eligible for {project.slug}.")
    return tutors[salt % len(tutors)]


def reserve(people, start, end):
    for person in people:
        for busy_start, busy_end in BUSY[person.pk]:
            if busy_start < end and start < busy_end:
                raise RuntimeError(f"Slot overlap for {person.email} at {start.isoformat()}.")
        BUSY[person.pk].append((start, end))


def add_evaluation(
    *,
    student,
    project,
    status,
    note="",
    picker=None,
    slot=None,
    cancelled_by=None,
    result=None,
    feedback="",
    opened_days_ago=None,
    expired_days_ago=None,
):
    start, end = slot_bounds(slot)
    now = timezone.now()
    if status in (EvaluationRequest.Status.PENDING, EvaluationRequest.Status.EXPIRED):
        picker = start = end = None
    picked = (picker is not None, start is not None, end is not None)
    if any(picked) and not all(picked):
        raise RuntimeError(f"Incomplete slot on {student.email} / {project.slug}.")
    if status in EvaluationRequest.PICKED_STATUSES and picker is None:
        raise RuntimeError(f"{status} request for {student.email} has no Hitchhiker.")
    if picker is not None:
        if picker.pk == student.pk:
            raise RuntimeError(f"{student.email} would evaluate themselves.")
        if not TutorEligibility.objects.filter(tutor=picker, project=project).exists():
            raise RuntimeError(f"{picker.email} is not eligible for {project.slug}.")
    if status == EvaluationRequest.Status.PENDING:
        opened_days_ago = opened_days_ago if opened_days_ago is not None else 3
        if opened_days_ago >= settings.EVALUATION_REQUEST_TTL_DAYS:
            raise RuntimeError("A pending request would be expired by the beat task.")
        created = now - timedelta(days=opened_days_ago)
    elif status == EvaluationRequest.Status.EXPIRED:
        created = now - timedelta(days=opened_days_ago or 21)
    elif start is not None:
        created = min(start - timedelta(days=2), now - timedelta(days=1))
    else:
        created = now - timedelta(days=opened_days_ago or 6)

    if status == EvaluationRequest.Status.CANCELLED:
        cancelled_by = cancelled_by or student
        if start is not None and start > now:
            cancelled_at = now - timedelta(hours=3)
        elif start is not None:
            cancelled_at = start - timedelta(hours=6)
        else:
            cancelled_at = created + timedelta(days=1)
    else:
        cancelled_by = None
        cancelled_at = None

    expired_at = at(-(expired_days_ago or 6), 8) if status == EvaluationRequest.Status.EXPIRED else None
    completed_at = None
    if result is not None:
        if status != EvaluationRequest.Status.CONFIRMED or end is None or end >= now:
            raise RuntimeError("A result belongs on a confirmed evaluation that already ended.")
        completed_at = end + timedelta(minutes=30)
    else:
        feedback = ""

    is_active = status in (
        EvaluationRequest.Status.PENDING,
        EvaluationRequest.Status.AWAITING_CONFIRMATION,
    ) or (status == EvaluationRequest.Status.CONFIRMED and end is not None and end > now)
    if is_active:
        pair = (student.pk, project.pk)
        if pair in ACTIVE_PAIRS:
            raise RuntimeError(f"Two active requests for {student.email} / {project.slug}.")
        ACTIVE_PAIRS.add(pair)
    if status in EvaluationRequest.PICKED_STATUSES:
        reserve((student, picker), start, end)

    evaluation = EvaluationRequest.objects.create(
        student=student,
        project=project,
        note=note,
        status=status,
        picked_by=picker,
        starts_at=start,
        ends_at=end,
        cancelled_by=cancelled_by,
        cancelled_at=cancelled_at,
        expired_at=expired_at,
        result=result,
        feedback=feedback,
        completed_at=completed_at,
    )
    updated = completed_at or cancelled_at or expired_at or created
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(created_at=created, updated_at=updated)
    evaluation.refresh_from_db()
    return evaluation


def seed_showcase():
    # Pending queue: one open request on every project, a second one on born2beroot.
    pending = (
        ("student01", "born2beroot", "Stuck on the partition table.", 2),
        ("student02", "push_swap", "Ready from Monday.", 3),
        ("student03", "minishell", "", 4),
        ("student04", "cpp09", "I would like an afternoon slot.", 5),
        ("student13", "codexion", "", 2),
        ("student14", "fly-in", "First time asking.", 3),
        ("student15", "rag-against-the-machine", "", 4),
        ("student16", "the-answer-protocol", "Happy to do it in English.", 5),
        ("student19", "agent-smith", "", 6),
        ("student20", "born2beroot", "Asking again after the last one expired.", 6),
    )
    for login, slug, note, age in pending:
        add_evaluation(
            student=USERS[login],
            project=PROJECTS[slug],
            status=EvaluationRequest.Status.PENDING,
            note=note,
            opened_days_ago=age,
        )

    # Awaiting the student's answer. Days and hours do not overlap for the same person.
    awaiting = (
        ("student05", "codexion", "hitchhiker03", 1, 9, ""),
        ("student06", "fly-in", "hitchhiker04", 1, 14, "Afternoons are best."),
        ("student07", "rag-against-the-machine", "hitchhiker05", 2, 9, ""),
        ("student08", "the-answer-protocol", "hitchhiker05", 2, 14, ""),
        ("student04", "agent-smith", "head02", 2, 16, ""),
        ("student01", "agent-smith", "hitchhiker06", 3, 9, "I can bring my own tests."),
        ("student02", "minishell", "hitchhiker01", 3, 14, ""),
    )
    for login, slug, picker, day, hour, note in awaiting:
        add_evaluation(
            student=USERS[login],
            project=PROJECTS[slug],
            status=EvaluationRequest.Status.AWAITING_CONFIRMATION,
            picker=USERS[picker],
            slot=("in", day, hour),
            note=note,
        )

    upcoming = (
        ("student09", "born2beroot", "hitchhiker01", 4, 9),
        ("student10", "push_swap", "hitchhiker02", 4, 14),
        ("student11", "cpp09", "head01", 5, 9),
        ("student12", "codexion", "hitchhiker04", 5, 14),
        ("student05", "minishell", "hitchhiker01", 6, 9),
        ("student09", "fly-in", "hitchhiker04", 6, 14),
    )
    for login, slug, picker, day, hour in upcoming:
        add_evaluation(
            student=USERS[login],
            project=PROJECTS[slug],
            status=EvaluationRequest.Status.CONFIRMED,
            picker=USERS[picker],
            slot=("in", day, hour),
            note="Confirmed.",
        )

    # Confirmed, already over, result not entered yet. History filter "result pending".
    waiting_for_result = (
        ("student13", "born2beroot", "hitchhiker08"),
        ("student14", "push_swap", "hitchhiker02"),
        ("student15", "minishell", "hitchhiker07"),
        ("student16", "cpp09", "head01"),
    )
    for login, slug, picker in waiting_for_result:
        add_evaluation(
            student=USERS[login],
            project=PROJECTS[slug],
            status=EvaluationRequest.Status.CONFIRMED,
            picker=USERS[picker],
            slot=("past",),
            note="Waiting for the result.",
        )

    add_evaluation(
        student=USERS["student20"],
        project=PROJECTS["push_swap"],
        status=EvaluationRequest.Status.CONFIRMED,
        picker=USERS["hitchhiker01"],
        slot=("past",),
        result=EvaluationRequest.Result.FAILED,
        feedback=FAILED_FEEDBACK,
    )
    add_evaluation(
        student=USERS["student17"],
        project=PROJECTS["born2beroot"],
        status=EvaluationRequest.Status.CANCELLED,
        opened_days_ago=9,
        note="Cancelled before anyone picked it.",
    )
    add_evaluation(
        student=USERS["student18"],
        project=PROJECTS["push_swap"],
        status=EvaluationRequest.Status.CANCELLED,
        picker=USERS["hitchhiker02"],
        slot=("past",),
        note="Cancelled the proposed slot.",
    )
    add_evaluation(
        student=USERS["student17"],
        project=PROJECTS["minishell"],
        status=EvaluationRequest.Status.CANCELLED,
        picker=USERS["head01"],
        cancelled_by=USERS["head01"],
        slot=("in", 7, 11),
        note="The student is away this week.",
    )
    add_evaluation(
        student=USERS["student19"],
        project=PROJECTS["cpp09"],
        status=EvaluationRequest.Status.EXPIRED,
        opened_days_ago=21,
        expired_days_ago=6,
    )
    add_evaluation(
        student=USERS["student20"],
        project=PROJECTS["fly-in"],
        status=EvaluationRequest.Status.EXPIRED,
        opened_days_ago=18,
        expired_days_ago=4,
    )


def seed_finished_accounts():
    plan = (
        ("born2beroot", "passed"),
        ("push_swap", "passed"),
        ("minishell", "passed"),
        ("cpp09", "passed"),
        ("codexion", "failed"),
        ("fly-in", "cancelled"),
        ("rag-against-the-machine", "expired"),
    )
    for index in range(1, 11):
        student = USERS[f"done{index:02d}"]
        for step, (slug, outcome) in enumerate(plan):
            project = PROJECTS[slug]
            if outcome in ("passed", "failed"):
                add_evaluation(
                    student=student,
                    project=project,
                    status=EvaluationRequest.Status.CONFIRMED,
                    picker=picker_for(project, student, index * 5 + step),
                    slot=("past",),
                    result=outcome,
                    feedback=PASSED_FEEDBACK if outcome == "passed" else FAILED_FEEDBACK,
                )
            elif outcome == "cancelled":
                add_evaluation(
                    student=student,
                    project=project,
                    status=EvaluationRequest.Status.CANCELLED,
                    opened_days_ago=12 + index,
                )
            else:
                add_evaluation(
                    student=student,
                    project=project,
                    status=EvaluationRequest.Status.EXPIRED,
                    opened_days_ago=22 + (index % 4),
                    expired_days_ago=7,
                )


def seed_extra_history():
    """Everyone except the five new accounts keeps at least two passed evaluations."""
    for salt, (login, user) in enumerate(USERS.items()):
        if login.startswith("new"):
            continue
        passed = EvaluationRequest.objects.filter(
            student=user, result=EvaluationRequest.Result.PASSED
        ).count()
        if passed >= 2:
            continue
        used = set(EvaluationRequest.objects.filter(student=user).values_list("project_id", flat=True))
        free = [project for project in PROJECTS.values() if project.id not in used]
        for offset, project in enumerate(free[: 2 - passed]):
            add_evaluation(
                student=user,
                project=project,
                status=EvaluationRequest.Status.CONFIRMED,
                picker=picker_for(project, user, salt + offset),
                slot=("past",),
                result=EvaluationRequest.Result.PASSED,
                feedback=PASSED_FEEDBACK,
            )


def add_message(sender, body, *, days_ago, unread, note=""):
    message = SCMessage.objects.create(
        sender=sender,
        body=body,
        discussion_note=note,
        discussion_note_version=1 if note else 0,
    )
    created = timezone.now() - timedelta(days=days_ago, hours=2)
    read_at = None if unread else created + timedelta(hours=3)
    SCMessage.objects.filter(pk=message.pk).update(
        created_at=created, updated_at=read_at or created, read_at=read_at
    )
    message.refresh_from_db()
    return message


def seed_council():
    letters = (
        (USERS["student01"], "The 3rd floor fridge is broken again.", 0, True, ""),
        (USERS["student05"], "Could we get more standing desks on the 4th floor?", 1, True, ""),
        (USERS["hitchhiker02"], "The evaluation rooms were double-booked yesterday afternoon.", 1, True, ""),
        (USERS["student12"], "Is the campus closed on the public holiday next week?", 2, True, ""),
        (
            USERS["student09"],
            "Thanks for the new coffee machine.",
            5,
            False,
            "Passed this to the campus team.",
        ),
        (USERS["done03"], "The quiet room on the 2nd floor is being used for calls.", 8, False, ""),
        (
            USERS["head02"],
            "Someone left a backpack in cluster 3.",
            12,
            False,
            "Already returned. Keeping the note.",
        ),
        (USERS["student18"], "The printer on the 1st floor jams on double-sided jobs.", 15, False, ""),
    )
    messages = []
    for sender, body, days_ago, unread, note in letters:
        messages.append(add_message(sender, body, days_ago=days_ago, unread=unread, note=note))
    return messages


def add_notification(recipient, notification_type, payload, target_url, *, days_ago, read):
    created = timezone.now() - timedelta(days=days_ago, minutes=40)
    read_at = created + timedelta(minutes=20) if read else None
    notification = Notification.objects.create(
        recipient=recipient,
        type=notification_type,
        payload=payload,
        target_url=target_url,
        read_at=read_at,
    )
    Notification.objects.filter(pk=notification.pk).update(created_at=created, updated_at=created)


def find(login, slug, status):
    return EvaluationRequest.objects.select_related(
        "student", "project", "picked_by", "cancelled_by"
    ).get(student=USERS[login], project=PROJECTS[slug], status=status)


def seed_notifications(messages):
    pending = EvaluationRequest.objects.filter(
        status=EvaluationRequest.Status.PENDING, student__email__endswith=f"@{DOMAIN}"
    ).select_related("project", "student")
    for index, evaluation in enumerate(pending):
        payload = {"request_id": evaluation.pk, "project": pref(evaluation.project)}
        target = f"/requests/{evaluation.pk}"
        add_notification(
            USERS["head01"],
            Notification.Type.EVALUATION_CREATED,
            payload,
            target,
            days_ago=0 if index < 4 else 6,
            read=index >= 4,
        )
        tutor = picker_for(evaluation.project, evaluation.student, index)
        if tutor.pk != USERS["head01"].pk:
            add_notification(
                tutor, Notification.Type.EVALUATION_CREATED, payload, target, days_ago=0, read=False
            )

    awaiting = (
        ("student05", "codexion"),
        ("student06", "fly-in"),
        ("student07", "rag-against-the-machine"),
        ("student08", "the-answer-protocol"),
        ("student04", "agent-smith"),
        ("student01", "agent-smith"),
        ("student02", "minishell"),
    )
    for login, slug in awaiting:
        evaluation = find(login, slug, EvaluationRequest.Status.AWAITING_CONFIRMATION)
        add_notification(
            evaluation.student,
            Notification.Type.EVALUATION_SLOT_PICKED,
            {
                "request_id": evaluation.pk,
                "project": pref(evaluation.project),
                "tutor": uref(evaluation.picked_by),
                "starts_at": iso(evaluation.starts_at),
                "ends_at": iso(evaluation.ends_at),
            },
            f"/evaluations/{evaluation.pk}",
            days_ago=0,
            read=False,
        )

    upcoming = (
        ("student09", "born2beroot", False),
        ("student10", "push_swap", True),
        ("student11", "cpp09", False),
        ("student12", "codexion", True),
        ("student05", "minishell", False),
        ("student09", "fly-in", True),
    )
    for login, slug, read in upcoming:
        evaluation = find(login, slug, EvaluationRequest.Status.CONFIRMED)
        add_notification(
            evaluation.picked_by,
            Notification.Type.EVALUATION_CONFIRMED,
            {
                "request_id": evaluation.pk,
                "project": pref(evaluation.project),
                "student": uref(evaluation.student),
                "starts_at": iso(evaluation.starts_at),
                "ends_at": iso(evaluation.ends_at),
            },
            f"/evaluations/{evaluation.pk}",
            days_ago=1 if read else 0,
            read=read,
        )

    declined = find("student03", "minishell", EvaluationRequest.Status.PENDING)
    add_notification(
        USERS["hitchhiker02"],
        Notification.Type.EVALUATION_DECLINED,
        {
            "request_id": declined.pk,
            "project": pref(declined.project),
            "student": uref(declined.student),
        },
        f"/evaluations/{declined.pk}",
        days_ago=5,
        read=True,
    )
    released = find("student04", "cpp09", EvaluationRequest.Status.PENDING)
    add_notification(
        released.student,
        Notification.Type.EVALUATION_RELEASED,
        {
            "request_id": released.pk,
            "project": pref(released.project),
            "tutor": uref(USERS["hitchhiker03"]),
        },
        f"/evaluations/{released.pk}",
        days_ago=4,
        read=True,
    )

    student_cancelled = find("student18", "push_swap", EvaluationRequest.Status.CANCELLED)
    cancelled_payload = {
        "request_id": student_cancelled.pk,
        "project": pref(student_cancelled.project),
        "cancelled_by": uref(student_cancelled.cancelled_by),
    }
    add_notification(
        student_cancelled.picked_by,
        Notification.Type.EVALUATION_CANCELLED,
        cancelled_payload,
        f"/evaluations/{student_cancelled.pk}",
        days_ago=2,
        read=False,
    )
    override = find("student17", "minishell", EvaluationRequest.Status.CANCELLED)
    add_notification(
        override.student,
        Notification.Type.EVALUATION_CANCELLED,
        {
            "request_id": override.pk,
            "project": pref(override.project),
            "cancelled_by": uref(override.cancelled_by),
        },
        f"/evaluations/{override.pk}",
        days_ago=0,
        read=False,
    )

    expired_pending = find("student19", "cpp09", EvaluationRequest.Status.EXPIRED)
    add_notification(
        expired_pending.student,
        Notification.Type.EVALUATION_EXPIRED,
        {
            "request_id": expired_pending.pk,
            "project": pref(expired_pending.project),
            "previous_status": EvaluationRequest.Status.PENDING,
        },
        f"/evaluations/{expired_pending.pk}",
        days_ago=1,
        read=False,
    )
    expired_waiting = find("student20", "fly-in", EvaluationRequest.Status.EXPIRED)
    expired_payload = {
        "request_id": expired_waiting.pk,
        "project": pref(expired_waiting.project),
        "previous_status": EvaluationRequest.Status.AWAITING_CONFIRMATION,
    }
    for recipient in (expired_waiting.student, USERS["hitchhiker06"]):
        add_notification(
            recipient,
            Notification.Type.EVALUATION_EXPIRED,
            expired_payload,
            f"/evaluations/{expired_waiting.pk}",
            days_ago=1,
            read=False,
        )

    passed = find("done01", "born2beroot", EvaluationRequest.Status.CONFIRMED)
    failed = find("done01", "codexion", EvaluationRequest.Status.CONFIRMED)
    another_fail = find("student20", "push_swap", EvaluationRequest.Status.CONFIRMED)
    for evaluation, read, age in ((passed, True, 12), (failed, False, 1), (another_fail, False, 0)):
        payload = {
            "request_id": evaluation.pk,
            "project": pref(evaluation.project),
            "result": evaluation.result,
        }
        for recipient in (evaluation.student, evaluation.picked_by):
            add_notification(
                recipient,
                Notification.Type.EVALUATION_RESULT_RECORDED,
                payload,
                f"/evaluations/{evaluation.pk}",
                days_ago=age,
                read=read,
            )

    requested = ELIGIBILITY["hitchhiker09"]
    requested_payload = {
        "request_id": requested.pk,
        "requester": uref(requested.requester),
        "projects": [pref(project) for project in requested.projects.order_by("name", "pk")],
    }
    for head in (USERS["head01"], USERS["head02"]):
        add_notification(
            head,
            Notification.Type.ELIGIBILITY_REQUESTED,
            requested_payload,
            f"/eligibility-requests/{requested.pk}",
            days_ago=0,
            read=False,
        )
    approved = ELIGIBILITY["hitchhiker01"]
    add_notification(
        USERS["hitchhiker01"],
        Notification.Type.ELIGIBILITY_DECIDED,
        {"request_id": approved.pk, "decision": "approved", "review_note": approved.review_note},
        f"/eligibility-requests/{approved.pk}",
        days_ago=20,
        read=True,
    )
    declined_request = ELIGIBILITY["hitchhiker08_declined"]
    add_notification(
        USERS["hitchhiker08"],
        Notification.Type.ELIGIBILITY_DECIDED,
        {
            "request_id": declined_request.pk,
            "decision": "declined",
            "review_note": declined_request.review_note,
        },
        f"/eligibility-requests/{declined_request.pk}",
        days_ago=2,
        read=False,
    )
    add_notification(
        USERS["hitchhiker07"],
        Notification.Type.ELIGIBILITY_REVOKED,
        {"project": pref(PROJECTS["cpp09"])},
        "/profile",
        days_ago=1,
        read=False,
    )
    add_notification(
        USERS["hitchhiker10"],
        Notification.Type.ROLE_CHANGED,
        {"role": "tutor", "action": "assigned"},
        "/profile",
        days_ago=8,
        read=True,
    )
    add_notification(
        USERS["student01"],
        Notification.Type.ACCOUNT_UPDATED,
        {"fields": ["display_name"]},
        "/profile",
        days_ago=9,
        read=True,
    )
    for message in messages:
        if message.read_at is not None:
            continue
        for member in (USERS["council01"], USERS["council02"]):
            add_notification(
                member,
                Notification.Type.SC_MESSAGE_CREATED,
                {"message_id": message.pk},
                f"/council/inbox/{message.pk}",
                days_ago=0,
                read=False,
            )


def check_seed():
    seed_users = User.objects.filter(email__endswith=f"@{DOMAIN}")
    if seed_users.count() != 50:
        raise RuntimeError(f"Expected 50 seed users, found {seed_users.count()}.")
    now = timezone.now()
    active = Q(
        status__in=(
            EvaluationRequest.Status.PENDING,
            EvaluationRequest.Status.AWAITING_CONFIRMATION,
        )
    ) | Q(status=EvaluationRequest.Status.CONFIRMED, ends_at__gt=now)
    if EvaluationRequest.objects.filter(
        active, student__email__startswith="done", student__email__endswith=f"@{DOMAIN}"
    ).exists():
        raise RuntimeError("A finished account still has an active request.")
    if EvaluationRequest.objects.filter(
        student__email__startswith="new", student__email__endswith=f"@{DOMAIN}"
    ).exists():
        raise RuntimeError("A new account has an evaluation.")
    if Notification.objects.filter(
        recipient__email__startswith="new", recipient__email__endswith=f"@{DOMAIN}"
    ).exists():
        raise RuntimeError("A new account has a notification.")
    pending_slugs = set(
        EvaluationRequest.objects.filter(
            status=EvaluationRequest.Status.PENDING, student__in=seed_users
        ).values_list("project__slug", flat=True)
    )
    if pending_slugs != set(PROJECT_SLUGS):
        raise RuntimeError(f"Open queue is missing {set(PROJECT_SLUGS) - pending_slugs}.")
    for login, user in USERS.items():
        if login.startswith("new"):
            continue
        passed = EvaluationRequest.objects.filter(
            student=user, result=EvaluationRequest.Result.PASSED
        ).count()
        if passed < 2 and not login.startswith("done"):
            raise RuntimeError(f"{user.email} has only {passed} passed evaluations.")
        if login.startswith("done") and passed < 4:
            raise RuntimeError(f"{user.email} does not have a finished history.")


def report():
    seed_users = User.objects.filter(email__endswith=f"@{DOMAIN}")
    print(f"\nPassword for every account: {PASSWORD}")
    print(f"Users: {seed_users.count()}")
    evaluations = EvaluationRequest.objects.filter(student__in=seed_users)
    for row in evaluations.values("status").annotate(total=Count("id")).order_by("status"):
        print(f"  evaluations {row['status']}: {row['total']}")
    print(
        "Eligibility requests: "
        f"{TutorEligibilityRequest.objects.filter(requester__in=seed_users).count()}"
    )
    print(f"Council messages: {SCMessage.objects.filter(sender__in=seed_users).count()}")
    print(f"Notifications: {Notification.objects.filter(recipient__in=seed_users).count()}")
    print("\nAccounts worth logging into:")
    for line in (
        "new01            empty student",
        "done01           history only: passed, failed, cancelled, expired",
        "student01        pending queue + a slot to confirm",
        "student05        slot to confirm + an upcoming evaluation",
        "student13        pending + result still to be entered",
        "student17        cancelled, including a Head Tutor override",
        "student19        expired request + a new pending one",
        "hitchhiker01     queue, awaiting, upcoming, history",
        "hitchhiker09     eligibility request waiting for review",
        "hitchhiker10     Hitchhiker welcome dialog, no projects yet",
        "head01           full queue and the eligibility review table",
        "head02           review + a slot waiting on the student",
        "council01        council inbox",
        "council02        council and Hitchhiker",
        "admin            Django admin at /admin/",
    ):
        print(f"  {line} @ {DOMAIN}")


def main():
    load_catalog()
    prototype = User()
    prototype.set_password(PASSWORD)
    with transaction.atomic():
        remove_previous_seed()
        make_users(prototype.password)
        seed_eligibility()
        seed_showcase()
        seed_finished_accounts()
        seed_extra_history()
        messages = seed_council()
        seed_notifications(messages)
        check_seed()
    report()


main()
