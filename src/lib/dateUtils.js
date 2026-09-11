const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const toIsoDate = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const createLocalDate = (year, month, day) => new Date(year, month - 1, day);

const isValidYmd = (year, month, day) => {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = createLocalDate(year, month, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

export const parseDateOnly = (dateStr) => {
  const match = String(dateStr || '').match(DATE_ONLY_RE);
  if (!match) return null;

  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);

  if (!isValidYmd(year, month, day)) return null;
  return createLocalDate(year, month, day);
};

export const formatDateOnly = (dateStr) => {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return dateStr || '-';

  return `${String(parsed.getDate()).padStart(2, '0')}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${parsed.getFullYear()}`;
};

export const normalizeImportedProjectDate = (
  dateStr,
  { preferPast = false, referenceDate = new Date(), futureToleranceDays = 14 } = {}
) => {
  const match = String(dateStr || '').match(DATE_ONLY_RE);
  if (!match) return dateStr || null;

  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);

  if (!isValidYmd(year, month, day)) return null;
  if (month > 12 || day > 12) return toIsoDate(year, month, day);

  const original = createLocalDate(year, month, day);
  const swapped = createLocalDate(year, day, month);
  const originalIso = toIsoDate(year, month, day);
  const swappedIso = toIsoDate(year, day, month);

  if (!preferPast || !isValidYmd(year, day, month)) {
    return originalIso;
  }

  const referenceDay = new Date(referenceDate);
  referenceDay.setHours(0, 0, 0, 0);
  const maxAllowed = new Date(referenceDay);
  maxAllowed.setDate(maxAllowed.getDate() + futureToleranceDays);

  const originalTooFarInFuture = original > maxAllowed;
  const swappedLooksReasonable = swapped <= maxAllowed;

  if (originalTooFarInFuture && swappedLooksReasonable) {
    return swappedIso;
  }

  return originalIso;
};
