import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin';
import { supabaseAdmin } from '../services/supabase';

const router = Router();

// Apply auth + admin middleware to all routes in this router
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/users
 * Returns list of all profiles with their associated unit names.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('*, units(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to retrieve users' });
    }

    return res.status(200).json(profiles);
  } catch (err) {
    console.error('Unexpected error in users list:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/users/:id/suspend
 * Suspends any user (except self and super admin). Freezes unit if it's a unit head.
 */
router.post('/:id/suspend', async (req: AuthenticatedRequest, res: Response) => {
  const currentAdmin = req.user!;
  const targetId = req.params.id;

  if (currentAdmin.id === targetId) {
    return res.status(400).json({ error: 'You cannot suspend your own account' });
  }

  try {
    // Get target user profile
    const { data: targetProfile, error: getError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single();

    if (getError || !targetProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetProfile.is_super_admin) {
      return res.status(400).json({ error: 'The Super Admin account cannot be suspended' });
    }

    // 1. Suspend the profile
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ account_status: 'suspended' })
      .eq('id', targetId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to suspend profile:', updateError);
      return res.status(500).json({ error: 'Failed to suspend user' });
    }

    // 2. If unit_head, freeze the associated unit
    if (updatedProfile.role === 'unit_head' && updatedProfile.unit_id) {
      await supabaseAdmin
        .from('units')
        .update({ status: 'frozen' })
        .eq('id', updatedProfile.unit_id);
    }

    return res.status(200).json({
      message: 'User suspended successfully',
      user: updatedProfile
    });
  } catch (err) {
    console.error('Unexpected suspension error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/users/:id/unsuspend
 * Unsuspends a user. Activates unit if unit head onboarding was complete.
 */
router.post('/:id/unsuspend', async (req: AuthenticatedRequest, res: Response) => {
  const targetId = req.params.id;

  try {
    // Get target user profile
    const { data: targetProfile, error: getError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single();

    if (getError || !targetProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 1. Unsuspend the profile
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ account_status: 'active' })
      .eq('id', targetId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to unsuspend profile:', updateError);
      return res.status(500).json({ error: 'Failed to unsuspend user' });
    }

    // 2. If unit_head and onboarding is completed, activate the unit
    if (updatedProfile.role === 'unit_head' && updatedProfile.unit_id && !updatedProfile.is_first_login) {
      await supabaseAdmin
        .from('units')
        .update({ status: 'active' })
        .eq('id', updatedProfile.unit_id);
    }

    return res.status(200).json({
      message: 'User unsuspended successfully',
      user: updatedProfile
    });
  } catch (err) {
    console.error('Unexpected unsuspension error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/users/:id/promote
 * Promotes a unit head to admin (Super Admin only).
 */
router.post('/:id/promote', requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const targetId = req.params.id;

  try {
    const { data: targetProfile, error: getError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single();

    if (getError || !targetProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetProfile.role === 'admin') {
      return res.status(400).json({ error: 'User is already an Admin' });
    }

    // Update role to admin and detach from unit (admins manage all units)
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'admin',
        unit_id: null
      })
      .eq('id', targetId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to promote user:', updateError);
      return res.status(500).json({ error: 'Failed to promote user' });
    }

    return res.status(200).json({
      message: 'User promoted to Admin successfully',
      user: updatedProfile
    });
  } catch (err) {
    console.error('Unexpected promotion error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/users/:id/demote
 * Demotes an admin back to unit head and assigns them to a unit (Super Admin only).
 */
router.post('/:id/demote', requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const currentAdmin = req.user!;
  const targetId = req.params.id;
  const { unitId } = req.body;

  if (currentAdmin.id === targetId) {
    return res.status(400).json({ error: 'You cannot demote yourself' });
  }

  if (!unitId) {
    return res.status(400).json({ error: 'A Unit ID must be provided to demote an admin to unit head' });
  }

  try {
    const { data: targetProfile, error: getError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single();

    if (getError || !targetProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetProfile.role === 'unit_head') {
      return res.status(400).json({ error: 'User is already a Unit Head' });
    }

    if (targetProfile.is_super_admin) {
      return res.status(400).json({ error: 'The Super Admin cannot be demoted' });
    }

    // Verify target unit exists and doesn't already have an active unit head
    const { data: unitProfiles, error: unitCheckError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('unit_id', unitId)
      .limit(1);

    if (unitCheckError) {
      return res.status(500).json({ error: 'Failed to verify unit availability' });
    }

    if (unitProfiles && unitProfiles.length > 0) {
      return res.status(400).json({ error: 'The target unit already has a Unit Head assigned' });
    }

    // Demote to unit head and attach to the unit
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'unit_head',
        unit_id: unitId
      })
      .eq('id', targetId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to demote user:', updateError);
      return res.status(500).json({ error: 'Failed to demote user' });
    }

    return res.status(200).json({
      message: 'User demoted to Unit Head successfully',
      user: updatedProfile
    });
  } catch (err) {
    console.error('Unexpected demotion error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * DELETE /api/users/:id
 * Deletes a user account entirely (Super Admin only).
 */
router.delete('/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const currentAdmin = req.user!;
  const targetId = req.params.id;

  if (currentAdmin.id === targetId) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    const { data: targetProfile, error: getError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single();

    if (getError || !targetProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetProfile.is_super_admin) {
      return res.status(400).json({ error: 'The Super Admin account cannot be deleted' });
    }

    // Delete user from Supabase Auth (which cascades to delete from profiles table)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetId);

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return res.status(500).json({ error: 'Failed to delete user account' });
    }

    return res.status(200).json({ message: 'User account deleted successfully' });
  } catch (err) {
    console.error('Unexpected deletion error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
