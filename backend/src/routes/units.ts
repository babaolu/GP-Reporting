import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { supabaseAdmin } from '../services/supabase';
import { generateTemporaryPassword } from '../lib/password-generator';
import { sendWelcomeEmail } from '../services/email';

const router = Router();

// Apply auth + admin middleware to all routes in this router
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/units
 * Lists all units.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: units, error } = await supabaseAdmin
      .from('units')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching units:', error);
      return res.status(500).json({ error: 'Failed to retrieve units' });
    }

    return res.status(200).json(units);
  } catch (err) {
    console.error('Unexpected error in units list:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/units/:id
 * Retrieve details of a single unit, including its current unit head's profile.
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const unitId = req.params.id;

    const { data: unit, error: unitError } = await supabaseAdmin
      .from('units')
      .select('*')
      .eq('id', unitId)
      .single();

    if (unitError || !unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    // Fetch corresponding unit head profile
    const { data: headProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('unit_id', unitId)
      .eq('role', 'unit_head')
      .maybeSingle();

    return res.status(200).json({
      ...unit,
      unitHead: headProfile || null
    });
  } catch (err) {
    console.error('Unexpected error fetching unit details:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/units
 * Creates a unit and its unit head atomically.
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, unitHeadEmail } = req.body;

  if (!name || !unitHeadEmail) {
    return res.status(400).json({ error: 'Unit Name and Unit Head Email are required' });
  }

  let createdUnitId: string | null = null;
  let createdAuthUserId: string | null = null;

  try {
    // 1. Create the unit in database (default status = 'frozen')
    const { data: unit, error: unitError } = await supabaseAdmin
      .from('units')
      .insert({
        name,
        description,
        status: 'frozen'
      })
      .select('id')
      .single();

    if (unitError || !unit) {
      console.error('Failed to create unit row:', unitError);
      return res.status(500).json({ error: 'Failed to create unit' });
    }

    createdUnitId = unit.id;

    // 2. Generate a secure random password
    const tempPassword = generateTemporaryPassword();

    // 3. Create Supabase Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: unitHeadEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: 'unit_head', unit_id: createdUnitId }
    });

    if (authError || !authData?.user) {
      console.error('Failed to create auth user for unit head:', authError);
      // Rollback: delete the unit row
      await supabaseAdmin.from('units').delete().eq('id', createdUnitId);
      return res.status(500).json({ error: `Failed to create auth account: ${authError?.message}` });
    }

    createdAuthUserId = authData.user.id;

    // 4. Create Profile row
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: createdAuthUserId,
      email: unitHeadEmail,
      role: 'unit_head',
      unit_id: createdUnitId,
      account_status: 'pending',
      is_first_login: true
    });

    if (profileError) {
      console.error('Failed to create profile row:', profileError);
      // Rollback: delete auth user and unit row
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      await supabaseAdmin.from('units').delete().eq('id', createdUnitId);
      return res.status(500).json({ error: 'Failed to create unit head profile' });
    }

    // 5. Send Welcome Email
    const emailSent = await sendWelcomeEmail(unitHeadEmail, tempPassword);
    if (!emailSent) {
      console.warn(`Welcome email failed to send to ${unitHeadEmail}, but account creation completed.`);
    }

    return res.status(201).json({
      message: 'Unit and Unit Head account created successfully. Welcome email sent.',
      unitId: createdUnitId,
      unitHeadId: createdAuthUserId,
      emailSent
    });

  } catch (err) {
    console.error('Unexpected error creating unit:', err);
    // Programmatic safety rollback
    if (createdAuthUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
    }
    if (createdUnitId) {
      await supabaseAdmin.from('units').delete().eq('id', createdUnitId);
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * PATCH /api/units/:id
 * Updates unit details (name, description).
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { name, description } = req.body;
  const unitId = req.params.id;

  try {
    const { data: updatedUnit, error } = await supabaseAdmin
      .from('units')
      .update({ name, description })
      .eq('id', unitId)
      .select('*')
      .single();

    if (error) {
      console.error('Failed to update unit details:', error);
      return res.status(500).json({ error: 'Failed to update unit' });
    }

    return res.status(200).json(updatedUnit);
  } catch (err) {
    console.error('Unexpected unit update error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/units/:id/change-head
 * Swaps unit heads. Deletes old unit head profile/auth user, puts unit in 'frozen' state,
 * and creates new unit head with temporary password.
 */
router.post('/:id/change-head', async (req: AuthenticatedRequest, res: Response) => {
  const unitId = req.params.id;
  const { newEmail } = req.body;

  if (!newEmail) {
    return res.status(400).json({ error: 'New Unit Head email is required' });
  }

  try {
    // 1. Get the existing unit head profile for this unit
    const { data: oldHead, error: findError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('unit_id', unitId)
      .eq('role', 'unit_head')
      .maybeSingle();

    // 2. Delete the old head profile (Auth deletion cascades to profiles table)
    if (oldHead) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(oldHead.id);
      if (deleteError) {
        console.error('Failed to delete old unit head auth user:', deleteError);
        return res.status(500).json({ error: 'Failed to delete previous unit head account' });
      }
    }

    // 3. Generate a secure random password for the new unit head
    const tempPassword = generateTemporaryPassword();

    // 4. Create new Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: newEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: 'unit_head', unit_id: unitId }
    });

    if (authError || !authData?.user) {
      console.error('Failed to create new unit head auth user:', authError);
      return res.status(500).json({ error: 'Failed to create new unit head auth account' });
    }

    const newAuthUserId = authData.user.id;

    // 5. Create new Profile row
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: newAuthUserId,
      email: newEmail,
      role: 'unit_head',
      unit_id: unitId,
      account_status: 'pending',
      is_first_login: true
    });

    if (profileError) {
      console.error('Failed to create new unit head profile row:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(newAuthUserId);
      return res.status(500).json({ error: 'Failed to create new unit head profile row' });
    }

    // 6. Freeze the unit until the new head completes onboarding
    await supabaseAdmin
      .from('units')
      .update({ status: 'frozen' })
      .eq('id', unitId);

    // 7. Send Welcome Email
    const emailSent = await sendWelcomeEmail(newEmail, tempPassword);
    if (!emailSent) {
      console.warn(`Welcome email failed to send to ${newEmail}`);
    }

    return res.status(200).json({
      message: 'Unit head changed successfully. Unit is frozen pending new head onboarding.',
      newUnitHeadId: newAuthUserId,
      emailSent
    });

  } catch (err) {
    console.error('Unexpected error changing unit head:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/units/:id/deactivate
 * Deactivates a unit and suspends the associated unit head.
 */
router.post('/:id/deactivate', async (req: AuthenticatedRequest, res: Response) => {
  const unitId = req.params.id;

  try {
    // 1. Deactivate unit status
    const { data: updatedUnit, error: unitError } = await supabaseAdmin
      .from('units')
      .update({ status: 'deactivated' })
      .eq('id', unitId)
      .select('*')
      .single();

    if (unitError) {
      console.error('Failed to deactivate unit:', unitError);
      return res.status(500).json({ error: 'Failed to deactivate unit' });
    }

    // 2. Suspend the unit head's account
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ account_status: 'suspended' })
      .eq('unit_id', unitId)
      .eq('role', 'unit_head');

    if (profileError) {
      console.error('Failed to suspend unit head during deactivation:', profileError);
    }

    return res.status(200).json({
      message: 'Unit deactivated and unit head account suspended successfully',
      unit: updatedUnit
    });

  } catch (err) {
    console.error('Unexpected unit deactivation error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
