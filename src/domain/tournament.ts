export interface Tournament {
  id: string;
  title: string;
  startAt: string;
  durationMinutes: number | null;
  price: number | null;
  currency: string;
  status: string;
  formatCode: string;
  formatName: string;
  isTeam: boolean | null;
  playersCount: number | null;
  playersLimit: number | null;
  teamsCount: number | null;
  teamsLimit: number | null;
  minGrade: string | null;
  maxGrade: string | null;
  displayMinGrade: string | null;
  displayMaxGrade: string | null;
  minRating: number | null;
  maxRating: number | null;
  genders: string[];
  ranking: boolean | null;
  club: { id: string; name: string; address: string; city: string };
  organizer: { id: string; name: string };
}

export function freeSpots(t: Tournament): number | null {
  return t.playersCount === null || t.playersLimit === null
    ? null : Math.max(t.playersLimit - t.playersCount, 0);
}

// Unknown enum values stay unknown. Never infer team participation from title/kind.
export function teamType(value: unknown): boolean | null {
  if (['TEAM', 'PAIR', 'PAIRS', 'DOUBLE', 'DOUBLES', 'TEAM_2', 'TWO_PLAYERS'].includes(String(value))) return true;
  if (['INDIVIDUAL', 'SINGLE', 'PERSONAL', 'NONE', 'ONE_PLAYER'].includes(String(value))) return false;
  return null;
}

export function genderType(genders: string[]): 'men' | 'women' | 'mixed' | 'unknown' {
  const men = genders.includes('MAN');
  const women = genders.includes('WOMAN');
  return men && women ? 'mixed' : men ? 'men' : women ? 'women' : 'unknown';
}
