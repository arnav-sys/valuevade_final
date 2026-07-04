import { supabase } from '../lib/supabase';

/**
 * One-click enrollment — inserts the full 22-module / 246-session default
 * curriculum for a user with NO customization wizard. Used by
 * CourseDetailsPage's "Enroll" button and any other direct-enrollment entry
 * point after the customize/preview/confirm wizard was removed.
 *
 * Steps (mirroring the flow ConfirmPage used to run):
 *   1. Upsert user_enrollments row (status: 'active')
 *   2. Delete any prior user_modules for this enrollment (idempotent re-enroll)
 *   3. Bulk insert user_modules for every master_module
 *   4. Bulk insert user_sessions for every master_session
 *   5. Seed user_module_projects for modules that have a master project
 *
 * Returns { enrollmentId } on success or throws.
 */
export async function enrollDirect({ userId, courseId, courseTitle }) {
  if (!userId) throw new Error('Not signed in.');
  if (!courseId) throw new Error('Missing course id.');

  // 1. Enrollment row (idempotent)
  const { data: existing } = await supabase
    .from('user_enrollments')
    .select('id')
    .eq('user_id', userId)
    .eq('master_path_id', courseId)
    .maybeSingle();

  let enrollmentId;
  if (existing?.id) {
    enrollmentId = existing.id;
    await supabase
      .from('user_modules')
      .delete()
      .eq('enrollment_id', enrollmentId);
    await supabase
      .from('user_enrollments')
      .update({ title: courseTitle || null, status: 'active' })
      .eq('id', enrollmentId);
  } else {
    const { data, error } = await supabase
      .from('user_enrollments')
      .insert({
        user_id: userId,
        master_path_id: courseId,
        title: courseTitle || null,
        status: 'active',
      })
      .select('id')
      .single();
    if (error) throw error;
    enrollmentId = data.id;
  }

  // 2. Fetch the master modules + sessions for this course
  const { data: modules, error: modErr } = await supabase
    .from('master_modules')
    .select('id, title, order_index, module_number, master_sessions(id, title, order_index, estimated_minutes)')
    .eq('path_id', courseId)
    .order('order_index');
  if (modErr) throw modErr;

  // 3. Bulk insert user_modules
  const modulePayload = (modules || []).map((mod) => ({
    enrollment_id: enrollmentId,
    master_module_id: mod.id,
    title: mod.title,
    order_index: mod.order_index,
    module_number: mod.module_number ?? mod.order_index,
    is_removed: false,
    ai_reasoning: null,
  }));
  const { data: insertedMods, error: insModErr } = await supabase
    .from('user_modules')
    .insert(modulePayload)
    .select('id, master_module_id');
  if (insModErr) throw insModErr;

  const userModIdByMaster = {};
  (insertedMods || []).forEach((r) => {
    if (r.master_module_id) userModIdByMaster[r.master_module_id] = r.id;
  });

  // 4. Bulk insert user_sessions
  const sessionPayload = [];
  (modules || []).forEach((mod) => {
    const umId = userModIdByMaster[mod.id];
    if (!umId) return;
    (mod.master_sessions || []).forEach((sess) => {
      sessionPayload.push({
        user_module_id: umId,
        master_session_id: sess.id,
        title: sess.title,
        order_index: sess.order_index ?? 0,
        is_removed: false,
        ai_reasoning: null,
        is_added_by_ai: false,
      });
    });
  });
  if (sessionPayload.length > 0) {
    const { error: sessErr } = await supabase.from('user_sessions').insert(sessionPayload);
    if (sessErr) throw sessErr;
  }

  // 5. Seed user_module_projects (best-effort — not fatal on error)
  try {
    const masterModuleIds = (modules || []).map((m) => m.id);
    if (masterModuleIds.length > 0) {
      const { data: masterProjects } = await supabase
        .from('master_module_projects')
        .select('id, module_id')
        .in('module_id', masterModuleIds);
      const projectByMaster = {};
      (masterProjects || []).forEach((p) => { projectByMaster[p.module_id] = p.id; });
      const projectRows = (insertedMods || [])
        .map((um) => {
          const mpId = projectByMaster[um.master_module_id];
          return mpId
            ? { user_module_id: um.id, master_project_id: mpId, is_completed: false, started_at: null }
            : null;
        })
        .filter(Boolean);
      if (projectRows.length > 0) {
        await supabase.from('user_module_projects').insert(projectRows);
      }
    }
  } catch (e) {
    // non-fatal; module projects are seeded lazily anyway
    // eslint-disable-next-line no-console
    console.warn('[enrollDirect] user_module_projects seed failed:', e);
  }

  return { enrollmentId };
}
