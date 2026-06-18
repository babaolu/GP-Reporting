import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';

const router = Router();

/**
 * POST /api/auth/onboarding
 * Mandatory onboarding completion flow for unit heads.
 */
router.post('/onboarding', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { fullName, phoneNumber, avatarUrl } = req.body;

  if (!fullName || !phoneNumber) {
    return res.status(400).json({ error: 'Full Name and Phone Number are required' });
  }

  try {
    // 1. Update the user profile
    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        phone_number: phoneNumber,
        avatar_url: avatarUrl || null,
        account_status: 'active',
        is_first_login: false
      })
      .eq('id', user.id)
      .select('*')
      .single();

    if (profileError || !updatedProfile) {
      console.error('Onboarding profile update failed:', profileError);
      return res.status(500).json({ error: 'Failed to update profile details' });
    }

    // 2. If unit_id is attached, set the unit status to 'active'
    if (updatedProfile.unit_id) {
      const { error: unitError } = await supabaseAdmin
        .from('units')
        .update({ status: 'active' })
        .eq('id', updatedProfile.unit_id);

      if (unitError) {
        console.error('Failed to activate unit during onboarding:', unitError);
        // We do not roll back the profile since they've already onboarded,
        // but we flag it in log.
      }
    }

    return res.status(200).json({
      message: 'Onboarding completed successfully',
      user: updatedProfile
    });
  } catch (err) {
    console.error('Unexpected onboarding error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
