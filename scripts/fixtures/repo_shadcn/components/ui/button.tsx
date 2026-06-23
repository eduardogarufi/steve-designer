export interface ButtonProps {
  variant?: "default" | "ghost";
  size?: "sm" | "lg";
  asChild?: boolean;
}
export function Button({ variant, size, asChild }: ButtonProps) {
  return <button data-variant={variant} data-size={size} />;
}
