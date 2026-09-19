import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
}

function Checkbox({ label, id, className = "", ...props }: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;

  return (
    <label htmlFor={checkboxId} className={["ui-checkbox", className].filter(Boolean).join(" ")}>
      <input id={checkboxId} type="checkbox" className="ui-checkbox__input" {...props} />
      <span className="ui-checkbox__control" aria-hidden="true" />
      <span className="ui-checkbox__label">{label}</span>
    </label>
  );
}

export default Checkbox;
