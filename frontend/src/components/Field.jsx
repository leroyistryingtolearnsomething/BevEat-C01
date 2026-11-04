import { useState } from "react";
import Icon from "./Icon.jsx";

// Parent-app text field: label, input, optional hint, inline error
export default function Field({ id, label, error, hint, prefix, type = "text", ...input }) {
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`input${error ? " input--error" : ""}`}>
        {prefix && <span className="input__prefix">{prefix}</span>}
        <input
          id={id}
          type={isPassword && shown ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...input}
        />
        {isPassword && (
          <button type="button" className="input__toggle" onClick={() => setShown(!shown)}
            aria-label={shown ? "Hide password" : "Show password"}>
            <Icon name={shown ? "eyeOff" : "eye"} size={22} />
          </button>
        )}
      </div>
      {hint && !error && <p className="field__hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="field__error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}
