export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54

export const kgToLb = (kg: number) => kg / KG_PER_LB
export const lbToKg = (lb: number) => lb * KG_PER_LB
export const cmToIn = (cm: number) => cm / CM_PER_IN
export const inToCm = (inch: number) => inch * CM_PER_IN

export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = cmToIn(cm)
  const ft = Math.floor(totalIn / 12)
  const inch = Math.round(totalIn - ft * 12)
  return { ft, inch }
}

export function ftInToCm(ft: number, inch: number): number {
  return inToCm(ft * 12 + inch)
}

export const round1 = (n: number) => Math.round(n * 10) / 10
