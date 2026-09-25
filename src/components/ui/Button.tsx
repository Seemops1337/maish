import { type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "xs" | "sm" | "md";
  icon?: ReactNode;
  iconOnly?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = "secondary",
  size = "sm",
  icon,
  iconOnly = false,
  children,
  className = "",
  disabled,
  ref,
  ...rest
}: ButtonProps) {
  const base = "inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/20 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "text-on-accent bg-accent hover:bg-accent-hover",
    // Icon-only secondary buttons sit in toolbars and stay borderless
    secondary: iconOnly
      ? "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
      : "text-text-primary bg-bg-primary border border-border-primary hover:bg-bg-hover",
    ghost: "text-text-tertiary hover:text-text-primary hover:bg-bg-hover",
    danger: "text-white bg-danger hover:bg-danger/90",
  };

  const sizes = iconOnly
    ? { xs: "p-1", sm: "p-1.5", md: "p-2" }
    : { xs: "h-6 px-2 text-xs gap-1", sm: "h-7 px-3 text-xs gap-1.5", md: "h-8 px-3.5 text-sm gap-2" };

  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
