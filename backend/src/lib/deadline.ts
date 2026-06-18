/**
 * Calculates the default deadline for a given reporting month.
 * The default deadline is the first Saturday of the following calendar month.
 * @param monthStr Month string formatted as 'YYYY-MM-DD' (e.g. '2025-06-01')
 * @returns Deadline string formatted as 'YYYY-MM-DD' (e.g. '2025-07-05')
 */
export function getDefaultDeadline(monthStr: string): string {
  const parts = monthStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10); // 1-indexed (e.g. 6 = June)

  // Determine the following month
  let nextMonthYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextMonthYear += 1;
  }

  // Create date object for the 1st of the following month in UTC
  const firstDayOfNextMonth = new Date(Date.UTC(nextMonthYear, nextMonth - 1, 1));
  const dayOfWeek = firstDayOfNextMonth.getUTCDay(); // 0 = Sunday, ..., 6 = Saturday

  // Calculate days to the first Saturday
  const daysToSaturday = (6 - dayOfWeek + 7) % 7;
  const firstSaturdayDateNum = 1 + daysToSaturday;

  const deadlineDate = new Date(Date.UTC(nextMonthYear, nextMonth - 1, firstSaturdayDateNum));
  return deadlineDate.toISOString().split('T')[0];
}

/**
 * Calculates reminder dates working backwards from the deadline.
 * - Reminder 1: deadline - 6 days
 * - Reminder 2: deadline - 3 days
 * - Reminder 3: deadline - 1 day
 * @param deadlineStr Deadline string formatted as 'YYYY-MM-DD'
 * @returns Object with r1, r2, and r3 as 'YYYY-MM-DD' strings
 */
export function getReminderDates(deadlineStr: string): { r1: string; r2: string; r3: string } {
  const parts = deadlineStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  const deadlineDate = new Date(Date.UTC(year, month - 1, day));

  const r1 = new Date(deadlineDate);
  r1.setUTCDate(deadlineDate.getUTCDate() - 6);

  const r2 = new Date(deadlineDate);
  r2.setUTCDate(deadlineDate.getUTCDate() - 3);

  const r3 = new Date(deadlineDate);
  r3.setUTCDate(deadlineDate.getUTCDate() - 1);

  return {
    r1: r1.toISOString().split('T')[0],
    r2: r2.toISOString().split('T')[0],
    r3: r3.toISOString().split('T')[0]
  };
}

/**
 * Formats a Date/string in YYYY-MM-DD format to a human-readable format:
 * e.g., '2025-07-05' -> 'Saturday, 5 July 2025'
 */
export function formatHumanDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const date = new Date(Date.UTC(year, monthIndex, day));
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayOfWeek = dayNames[date.getUTCDay()];
  const monthName = monthNames[date.getUTCMonth()];

  return `${dayOfWeek}, ${day} ${monthName} ${year}`;
}
