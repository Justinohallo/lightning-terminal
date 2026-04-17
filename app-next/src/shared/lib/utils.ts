import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `cn` — compose Tailwind classes conditionally, dedupe conflicting utilities.
 * The standard shadcn/ui helper. Used by every component in `shared/ui/`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
