import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Los tamaños de texto y las alturas propias de tailwind.config.ts (text-14,
// h-control…) no los conoce tailwind-merge: sin esto toma `text-14` por un
// color de texto y descarta el `text-surface` de los botones, que quedaban
// con texto oscuro sobre fondo azul.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["11", "12", "13", "14", "15", "16", "17", "19", "20", "22", "26", "28", "40"] },
      ],
      h: [{ h: ["topbar", "control", "field", "row"] }],
    },
  },
})

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
