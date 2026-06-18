/**
 * Formats a YYYY-MM-DD date string representing a month into a human readable format.
 * E.g., '2026-06-01' -> 'June 2026'
 */
export function formatMonthLabel(monthStr: string): string {
  if (!monthStr) return '';
  const parts = monthStr.split('-');
  const year = parts[0];
  const monthNum = parseInt(parts[1], 10);
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return `${monthNames[monthNum - 1]} ${year}`;
}

/**
 * Returns the current calendar month in YYYY-MM-01 format.
 * Utilizes local time mapping.
 */
export function getCurrentReportingMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Generates an array of the last `count` months in YYYY-MM-01 format, newest first.
 */
export function getPastMonthsList(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}-01`);
  }
  
  return months;
}

/**
 * Formats standard date strings to local date strings:
 * E.g., '2026-06-18T15:00:00.000Z' -> '18 Jun 2026, 3:00 PM'
 */
export function formatDateTime(dateTimeStr: string): string {
  if (!dateTimeStr) return 'N/A';
  const d = new Date(dateTimeStr);
  if (isNaN(d.getTime())) return dateTimeStr;

  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'

  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

/**
 * Format date only:
 * E.g., '2026-07-04' -> 'Saturday, 4 July 2026'
 */
export function formatHumanDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const date = new Date(year, monthIndex, day);
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return `${dayNames[date.getDay()]}, ${day} ${monthNames[date.getMonth()]} ${year}`;
}
