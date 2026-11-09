import { useTranslation } from "react-i18next";

import ReasonDialog, { type ReasonDialogTone } from "../../components/ui/ReasonDialog";

export type AccountAction = "suspend" | "reactivate" | "delete";

interface AccountActionDialogProps {
  action: AccountAction;
  // The display name of the account the action is for.
  name: string;
  isSubmitting: boolean;
  // Translated text of the last failure, shown inside the popup.
  error: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

// Deletion cannot be undone, so its popup is red; reactivation restores the account.
const tones: Record<AccountAction, ReasonDialogTone> = {
  suspend: "warning",
  reactivate: "positive",
  delete: "danger",
};

// Confirms a suspension, reactivation or deletion with the reason the backend requires
// (api-plan §10.2).
function AccountActionDialog({ action, name, ...rest }: AccountActionDialogProps) {
  const { t } = useTranslation();

  return (
    <ReasonDialog
      title={t(`adminUser.actions.${action}Title`, { name })}
      text={t(`adminUser.actions.${action}Text`)}
      confirmLabel={t(`adminUser.actions.${action}Confirm`)}
      workingLabel={t(`adminUser.actions.${action}Working`)}
      tone={tones[action]}
      {...rest}
    />
  );
}

export default AccountActionDialog;
