import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../api/client";
import { assignRole, revokeRole } from "../../api/users";
import i18n from "../../i18n";
import type { PublicUser } from "../../types/people";
import type { ManagedRoleName, UserRole } from "../../types/user";
import { assignableRoles, canRevokeRoles } from "./roleRules";

interface RoleManagerProps {
  // The person whose profile is open, never the logged-in user.
  person: PublicUser;
  // The logged-in user's real roles from GET /users/me/, not the active workspace.
  myRoles: UserRole[];
  // Gets the person with their new roles after a change.
  onChange: (person: PublicUser) => void;
}

// The message for a failed change, chosen by the error code (api-plan §5.6, §10.2).
function roleErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "role_not_assignable") {
      return i18n.t("person.roleNotAssignable");
    }

    if (error.code === "role_not_revocable") {
      return i18n.t("person.roleNotRevocable");
    }

    if (error.code === "cannot_modify_self") {
      return i18n.t("person.roleCannotModifySelf");
    }

    if (error.code === "permission_denied") {
      return i18n.t("person.rolePermissionDenied");
    }

    if (error.code === "not_found") {
      return i18n.t("person.roleNotFound");
    }
  }

  return i18n.t("person.roleError");
}

// "Manage roles" on a profile (#679): a Head Tutor gives `tutor`, an SC Member `sc_member`, an
// Admin gives and removes `tutor`, `head_tutor` and `sc_member` (api-plan §5.8, §10.2). Only what
// the user may do is offered; the backend still checks every request. Nothing is shown to users
// who may do neither.
function RoleManager({ person, myRoles, onChange }: RoleManagerProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ManagedRoleName | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const held = person.roles.map((role) => role.name);
  // What the user may give, without the roles the person already has.
  const toAdd = assignableRoles(myRoles).filter((role) => !held.includes(role));
  // `student` and `admin` are never removed through the API (§5.8).
  const toRemove = canRevokeRoles(myRoles)
    ? person.roles.filter((role) => role.name !== "student" && role.name !== "admin")
    : [];
  // The picked role while it can still be added, otherwise the first one left.
  const chosen: ManagedRoleName | undefined =
    selected !== null && toAdd.includes(selected) ? selected : toAdd[0];

  if (assignableRoles(myRoles).length === 0 && !canRevokeRoles(myRoles)) {
    return null;
  }

  async function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (chosen === undefined) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatus("");

    try {
      // 200 with the person's updated PublicUser (§10.2).
      onChange(await assignRole(person.id, chosen));
      setStatus(t("person.roleAdded", { role: t(`roles.${chosen}`) }));
    } catch (caught) {
      setError(roleErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  async function removeRole(role: UserRole) {
    setIsSaving(true);
    setError(null);
    setStatus("");

    try {
      await revokeRole(person.id, role.id);
      // 204 has no body, but it means the person no longer holds the role (§10.2).
      onChange({ ...person, roles: person.roles.filter((current) => current.id !== role.id) });
      setStatus(t("person.roleRemoved", { role: t(`roles.${role.name}`) }));
    } catch (caught) {
      setError(roleErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="person-profile__panel" aria-labelledby="person-profile-manage">
      <div className="person-profile__panel-head">
        <h2 id="person-profile-manage">{t("person.manageRoles")}</h2>
      </div>

      {toRemove.length > 0 && (
        <ul className="person-profile__manage-list" aria-label={t("person.removableRolesAria")}>
          {toRemove.map((role) => (
            <li key={role.id}>
              <span>{t(`roles.${role.name}`)}</span>
              <button
                className="person-profile__manage-remove"
                type="button"
                disabled={isSaving}
                aria-label={t("person.removeRoleAria", { role: t(`roles.${role.name}`) })}
                onClick={() => removeRole(role)}
              >
                {t("person.removeRole")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {toAdd.length > 0 ? (
        <form className="person-profile__manage-form" onSubmit={addRole}>
          <label htmlFor="person-profile-role">{t("person.roleToAdd")}</label>
          <select
            id="person-profile-role"
            value={chosen}
            disabled={isSaving}
            onChange={(event) => setSelected(event.target.value as ManagedRoleName)}
          >
            {toAdd.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </select>
          <button
            className="person-profile__action person-profile__action--primary"
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? t("person.savingRole") : t("person.addRole")}
          </button>
        </form>
      ) : (
        <p className="person-profile__note">{t("person.nothingToAdd")}</p>
      )}

      {error && (
        <p className="person-profile__manage-error" role="alert">
          {error}
        </p>
      )}

      {/* Always in the page, so screen readers announce the text when it appears. */}
      <p className="person-profile__manage-status" role="status">
        {status}
      </p>
    </section>
  );
}

export default RoleManager;
