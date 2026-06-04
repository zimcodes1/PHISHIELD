export function LogoIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6l-9-4zm-1 13l-3-3 1.41-1.41L11 13.17l4.59-4.58L17 10l-6 5z" />
    </svg>
  );
}