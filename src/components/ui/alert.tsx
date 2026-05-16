import { cn } from "@/lib/cn";

type AlertProps = {
  title: string;
  children?: React.ReactNode;
  variant?: "error" | "warning" | "success" | "info";
  className?: string;
};

const variants = {
  error: "portal-alert portal-alert-error",
  warning: "portal-alert portal-alert-warning",
  success: "portal-alert portal-alert-success",
  info: "portal-alert portal-alert-info",
};

export function Alert({ title, children, variant = "error", className }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(variants[variant], className)}
    >
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-2 opacity-90">{children}</div> : null}
    </div>
  );
}
