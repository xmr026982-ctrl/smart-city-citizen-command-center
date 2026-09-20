function Button({ variant = "primary", className = "", ...props }) {
  return (
    <button
      className={`btn ${variant === "secondary" ? "btn-secondary" : "btn-primary"} ${className}`}
      {...props}
    />
  );
}

export default Button;