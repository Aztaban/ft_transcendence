import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";

interface TextAreaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "maxLength" | "className"
> {
  label: ReactNode;
  value: string;
  maxLength: number;
  // The page's own classes for the label around everything and for the counter.
  className?: string;
  countClassName?: string;
}

// From this many characters left, screen readers hear how many remain.
const ANNOUNCE_FROM = 20;

// A labelled text area with a visible "12 / 500" counter (#730). The counter itself is not read
// on every key; a hidden live line says how many characters are left near the limit only.
function TextArea({
  label,
  value,
  maxLength,
  className = "",
  countClassName = "",
  ...props
}: TextAreaProps) {
  const { t } = useTranslation();
  const id = useId();
  const labelId = `${id}-label`;
  const countId = `${id}-count`;
  // Counted by character, like the backend, so an emoji counts once (#763).
  const used = Array.from(value).length;
  const left = maxLength - used;

  return (
    <label className={className || "ui-textarea"}>
      <span id={labelId}>{label}</span>
      {/* Named by the label text only, not by the counter inside the same <label>. */}
      <textarea
        value={value}
        maxLength={maxLength}
        aria-labelledby={labelId}
        aria-describedby={countId}
        {...props}
      />
      <span id={countId} className={countClassName || "ui-textarea__count"}>
        {used} / {maxLength}
      </span>
      <span className="ui-sr-only" aria-live="polite">
        {left <= ANNOUNCE_FROM ? t("designSystem.charactersLeft", { count: left }) : ""}
      </span>
    </label>
  );
}

export default TextArea;
