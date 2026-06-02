type Props = {
  message?: string;
};

export default function Preloader({ message = "Loading..." }: Props) {
  return (
    <div className="min-h-64 flex items-center justify-center px-6 py-12">
      <div className="flex items-center gap-3 text-sm text-ink-muted">
        <i className="bx bx-loader-alt animate-spin text-2xl text-brand-500" />
        <span>{message}</span>
      </div>
    </div>
  );
}
