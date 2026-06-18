import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';

interface DeadlineData {
  id?: string;
  month: string;
  deadline_date: string;
  first_reminder_sent: boolean;
  is_default?: boolean;
}

export function useDeadline(month: string) {
  const [deadline, setDeadline] = useState<DeadlineData | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeadline = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<DeadlineData>(`/deadlines/${month}`);
      setDeadline(data);
      
      // Calculate days remaining
      if (data.deadline_date) {
        const parts = data.deadline_date.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        
        const deadlineDate = new Date(y, m, d, 23, 59, 59, 999);
        const now = new Date();
        
        const diffMs = deadlineDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        setDaysRemaining(diffDays < 0 ? 0 : diffDays);
      }
    } catch (err: any) {
      console.error('Failed to load deadline:', err);
      setError(err.message || 'Failed to load deadline');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (month) {
      fetchDeadline();
    }
  }, [month]);

  return {
    deadline,
    daysRemaining,
    isLocked: deadline?.first_reminder_sent || false,
    isLoading,
    error,
    refetch: fetchDeadline
  };
}
export default useDeadline;
