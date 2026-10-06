from django.conf import settings
from django.db import models
from django.db.models import F, Q

from apps.core.models import TimeStampedModel


class Project(TimeStampedModel):
    """an intra's project students can request an evaluation for (schema 3.1)."""

    id = models.BigAutoField(primary_key=True)
    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "project"
        ordering = ["name"]

    def __str__(self):
        return self.name


class TutorEligibilityRequest(TimeStampedModel):
    """One Hitchhiker's request to evaluate a set of projects (schema 3.2)"""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        DECLINED = "declined", "Declined"

    id = models.BigAutoField(primary_key=True)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="eligibility_requests",
    )
    projects = models.ManyToManyField(
        Project,
        through="TutorEligibilityRequestProject",
        related_name="eligibility_requests",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "tutor_eligibility_request"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(status="pending", reviewed_by__isnull=True, reviewed_at__isnull=True)
                    | (~Q(status="pending") & Q(reviewed_at__isnull=False))
                ),
                name="elig_req_review_consistent",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "created_at"], name="elig_req_status_created"),
        ]

    def __str__(self):
        return f"Eligibility request {self.pk} ({self.status})"


class TutorEligibilityRequestProject(models.Model):
    """The projects listed in one eligibility request (schema 3.3)"""

    id = models.BigAutoField(primary_key=True)
    request = models.ForeignKey(TutorEligibilityRequest, on_delete=models.CASCADE)
    project = models.ForeignKey(Project, on_delete=models.PROTECT)

    class Meta:
        db_table = "tutor_eligibility_request_projects"
        constraints = [
            models.UniqueConstraint(fields=["request", "project"], name="uniq_elig_req_project"),
        ]


class TutorEligibility(TimeStampedModel):
    """A Hitchhiker's current permission to evaluate one project (schema 3.4)."""

    id = models.BigAutoField(primary_key=True)
    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="eligibilities",
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="eligibilities")
    granted_by_request = models.ForeignKey(
        TutorEligibilityRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_eligibilities",
    )

    class Meta:
        db_table = "tutor_eligibility"
        constraints = [
            models.UniqueConstraint(fields=["tutor", "project"], name="uniq_tutor_project"),
        ]

    def __str__(self):
        return f"{self.tutor_id} → {self.project_id}"


class EvaluationRequest(TimeStampedModel):
    """A student's request, the Hitchhiker's slot on it, and later its result (schema 4.1)"""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        AWAITING_CONFIRMATION = "awaiting_confirmation", "Awaiting confirmation"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"
        EXPIRED = "expired", "Expired"

    class Result(models.TextChoices):
        PASSED = "passed", "Passed"
        FAILED = "failed", "Failed"

    PICKED_STATUSES = (Status.AWAITING_CONFIRMATION, Status.CONFIRMED)

    id = models.BigAutoField(primary_key=True)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="evaluation_requests",
    )
    project = models.ForeignKey(
        Project, on_delete=models.PROTECT, related_name="evaluation_requests"
    )
    note = models.CharField(max_length=500, blank=True, default="")
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING)
    picked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="picked_evaluation_requests",
    )
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    expired_at = models.DateTimeField(null=True, blank=True)
    result = models.CharField(max_length=16, choices=Result.choices, null=True, blank=True)
    feedback = models.TextField(blank=True, default="")
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "evaluation_request"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(picked_by__isnull=True, starts_at__isnull=True, ends_at__isnull=True)
                    | Q(picked_by__isnull=False, starts_at__isnull=False, ends_at__isnull=False)
                ),
                name="eval_req_pick_consistent",
            ),
            models.CheckConstraint(
                condition=(
                    Q(status__in=["awaiting_confirmation", "confirmed"], picked_by__isnull=False)
                    | (
                        ~Q(status__in=["awaiting_confirmation", "confirmed"])
                        & Q(picked_by__isnull=True)
                    )
                ),
                name="eval_req_pick_matches_status",
            ),
            models.CheckConstraint(
                condition=(
                    Q(starts_at__isnull=True)
                    | Q(ends_at__isnull=True)
                    | Q(ends_at__gt=F("starts_at"))
                ),
                name="eval_req_slot_order",
            ),
            models.CheckConstraint(
                condition=(
                    Q(status="cancelled", cancelled_at__isnull=False)
                    | (~Q(status="cancelled") & Q(cancelled_at__isnull=True))
                ),
                name="eval_req_cancel_consistent",
            ),
            models.CheckConstraint(
                condition=(
                    Q(status="expired", expired_at__isnull=False)
                    | (~Q(status="expired") & Q(expired_at__isnull=True))
                ),
                name="eval_req_expire_consistent",
            ),
            models.CheckConstraint(
                condition=Q(status="confirmed") | Q(result__isnull=True, completed_at__isnull=True),
                name="eval_req_result_only_confirmed",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "project", "created_at"], name="eval_req_open_queue"),
            models.Index(fields=["student", "status"], name="eval_req_student"),
            models.Index(fields=["picked_by", "status", "starts_at"], name="eval_req_picked_by"),
            models.Index(fields=["status", "starts_at"], name="eval_req_expiry"),
        ]

    def __str__(self):
        return f"Evaluation request {self.pk} ({self.status})"
