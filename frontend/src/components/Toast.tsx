type AlertVariant = "error" | "success" | "warning" | "info";

interface AlertProps {
  variant: AlertVariant;
  message: string;
  onDismiss?: () => void;
}

const config: Record<AlertVariant, { icon: string; classes: string }> = {
  error:   { icon: "bx-x-circle",      classes: "bg-danger/8 border-danger/30 text-danger" },
  success: { icon: "bx-check-circle",  classes: "bg-safe/8 border-safe/30 text-safe" },
  warning: { icon: "bx-error",         classes: "bg-caution/8 border-caution/30 text-caution" },
  info:    { icon: "bx-info-circle",   classes: "bg-brand-50 border-brand-200 text-brand-600" },
};

export function Alert({ variant, message, onDismiss }: AlertProps) {
  const { icon, classes } = config[variant];
  return (
    <div className={`flex items-start gap-3 border rounded-xl px-4 py-3 text-sm ${classes}`}>
      <i className={`bx ${icon} text-lg shrink-0 mt-0.5`} />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 opacity-60 hover:opacity-100 transition cursor-pointer"
        >
          <i className="bx bx-x text-lg" />
        </button>
      )}
    </div>
  );
}

// Keep ErrorToast export so other files don't break
export const ErrorToast = ({ message }: { message: string }) => (
  <Alert variant="error" message={message} />
);
