import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Concuerda un sustantivo con su cantidad: `plural(1, 'oferta', 'ofertas')`
 * devuelve `"1 oferta"`. Vive acá para que las pantallas no repitan el mismo
 * ternario en cada contador.
 */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
