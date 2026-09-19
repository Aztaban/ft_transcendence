import { useId } from "react";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

function Input({ label, error, id, className = "", ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="ui-field">
      {label && (
        <label className="ui-field__label" htmlFor={inputId}>
          {label}
        </label>
      )}

      <input
        id={inputId}
        className={["ui-input", error ? "ui-input--error" : "", className]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />

      {error && (
        <span id={errorId} className="ui-field__error">
          {error}
        </span>
      )}
    </div>
  );
}

export default Input;
