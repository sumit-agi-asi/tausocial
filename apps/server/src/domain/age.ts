export type AgeBand = 'under14' | '14-17' | '18-39' | '40plus';

export function ageOn(birthDate: string, now: Date = new Date()): number {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) {
    age -= 1;
  }
  return age;
}

/** Age brackets taken from the design sketch (<14, <18, <40, >40). */
export function ageBand(age: number): AgeBand {
  if (age < 14) return 'under14';
  if (age < 18) return '14-17';
  if (age < 40) return '18-39';
  return '40plus';
}
