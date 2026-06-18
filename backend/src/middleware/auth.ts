import { Response, NextFunction, Request } from 'express';
import { supabaseAdmin } from '../services/supabase';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'admin' | 'unit_head';
    is_super_admin: boolean;
    unit_id: string | null;
    account_status: 'pending' | 'active' | 'suspended';
    is_first_login: boolean;
    full_name: string | null;
    phone_number: string | null;
    avatar_url: string | null;
    telegram_chat_id: string | null;
    telegram_linked: boolean;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify user JWT token with Supabase Auth
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token session' });
    }

    // Retrieve corresponding user profile details from the profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'Unauthorized: Profile not found' });
    }

    // Check if user is suspended
    if (profile.account_status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended. Please contact the administrator.' });
    }

    // Attach profile to the request
    req.user = profile;
    next();
  } catch (err) {
    console.error('Error in requireAuth middleware:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
