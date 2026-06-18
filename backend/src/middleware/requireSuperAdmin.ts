import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  if (req.user.role !== 'admin' || !req.user.is_super_admin) {
    return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
  }

  next();
}
