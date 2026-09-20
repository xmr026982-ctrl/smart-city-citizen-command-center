import { forwardRef } from "react";

export const Input = forwardRef(function Input(
  { invalid, className = "", ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={`input${invalid ? " invalid" : ""} ${className}`}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select(
  { invalid, className = "", children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={`select${invalid ? " invalid" : ""} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea(
  { invalid, className = "", ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={`textarea${invalid ? " invalid" : ""} ${className}`}
      {...props}
    />
  );
});

export function Label({ htmlFor, required, children }) {
  return (
    <label className="field-label" htmlFor={htmlFor}>
      {children}
      {required ? <span className="req">*</span> : null}
    </label>
  );
}

export default Input;