import { forwardRef } from "react";

interface UiButtonProps {
  variant?: string;
  size?: string;
}

export function UiButton({ variant, size }: UiButtonProps) {
  return <button data-variant={variant} data-size={size} />;
}

export const UiCloseIconButton = forwardRef<HTMLButtonElement>((_, ref) => (
  <button ref={ref} />
));

export function StatusPill({ label }: { label: string }) {
  return <span>{label}</span>;
}

// not a component export — must be ignored
export const useThing = () => 1;
