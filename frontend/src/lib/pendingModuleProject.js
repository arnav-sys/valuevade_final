/**
 * Retro-lock helper, finds the earliest pending Module Project for a user,
 * and lazy-backfills any missing user_module_projects rows for modules the
 * user already finished before the project gate existed.
 *
 * A "pending project" = user_module.is_completed=true AND
 * user_module_projects.is_completed=false AND a master_module_projects row
 * exists for its master_module_id.
 *
 * Idempotent and best-effort. Never throws, returns null on any error.
 */
import { supabase } from './supabase';

export async function getPendingModuleProject(userId) {
  try {
    if (!userId) return null;

    // 1. Enrollments → user_modules (with completion state + master_module_id)
    const { data: enrs } = await supabase
      .from('user_enrollments')
      .select('id')
      .eq('user_id', userId);
    const enrollmentIds = (enrs || []).map((e) => e.id);
    if (enrollmentIds.length === 0) return null;

    const { data: ums } = await supabase
      .from('user_modules')
      .select('id, title, order_index, module_number, master_module_id, enrollment_id, is_completed')
      .in('enrollment_id', enrollmentIds)
      .order('order_index');
    const modules = ums || [];
    if (modules.length === 0) return null;

    // Compute is_module_done from user_sessions (more robust than
    // user_modules.is_completed which isn't auto-set anywhere).
    const moduleIds = modules.map((m) => m.id);
    const { data: sessRows } = await supabase
      .from('user_sessions')
      .select('user_module_id, is_completed, is_removed')
      .in('user_module_id', moduleIds)
      .eq('is_removed', false);
    const sessByMod = {};
    (sessRows || []).forEach((s) => {
      if (!sessByMod[s.user_module_id]) sessByMod[s.user_module_id] = [];
      sessByMod[s.user_module_id].push(s);
    });
    modules.forEach((m) => {
      const list = sessByMod[m.id] || [];
      m._done = list.length > 0 && list.every((s) => s.is_completed);
    });

    // 2. All user_module_projects for these modules
    const { data: umpsRaw } = await supabase
      .from('user_module_projects')
      .select('id, user_module_id, master_project_id, is_completed')
      .in('user_module_id', moduleIds);
    const umps = umpsRaw || [];
    const umpByModule = {};
    umps.forEach((p) => { umpByModule[p.user_module_id] = p; });

    // 3. Backfill: for done modules with no user_module_projects row but
    //    a master_module_projects definition, insert the missing row.
    const completedMissing = modules.filter(
      (m) => m._done && !umpByModule[m.id] && m.master_module_id,
    );
    if (completedMissing.length > 0) {
      const masterIds = completedMissing.map((m) => m.master_module_id);
      const { data: mps } = await supabase
        .from('master_module_projects')
        .select('id, module_id')
        .in('module_id', masterIds);
      const mpByMaster = {};
      (mps || []).forEach((mp) => { mpByMaster[mp.module_id] = mp.id; });

      const rows = completedMissing
        .map((m) => (mpByMaster[m.master_module_id]
          ? {
              user_module_id: m.id,
              master_project_id: mpByMaster[m.master_module_id],
              is_completed: false,
              started_at: null,
            }
          : null))
        .filter(Boolean);
      if (rows.length > 0) {
        try {
          const { data: inserted } = await supabase
            .from('user_module_projects')
            .insert(rows)
            .select('id, user_module_id, master_project_id, is_completed');
          (inserted || []).forEach((p) => { umpByModule[p.user_module_id] = p; });
        } catch {
          // Race on unique key → ignore. Refetch just those rows.
          const { data: refetch } = await supabase
            .from('user_module_projects')
            .select('id, user_module_id, master_project_id, is_completed')
            .in('user_module_id', rows.map((r) => r.user_module_id));
          (refetch || []).forEach((p) => { umpByModule[p.user_module_id] = p; });
        }
      }
    }

    // 4. Pick earliest pending: module done + project is_completed=false
    const pendingModule = modules.find(
      (m) => m._done && umpByModule[m.id] && !umpByModule[m.id].is_completed,
    );
    if (!pendingModule) return null;

    // 5. Attach the master project title for the banner
    const mpId = umpByModule[pendingModule.id].master_project_id;
    let masterTitle = null;
    if (mpId) {
      const { data: mp } = await supabase
        .from('master_module_projects')
        .select('title')
        .eq('id', mpId)
        .maybeSingle();
      masterTitle = mp?.title || null;
    }

    return {
      user_module_id: pendingModule.id,
      module_title: pendingModule.title,
      module_number: pendingModule.module_number ?? pendingModule.order_index,
      module_order_index: pendingModule.order_index,
      master_project_id: mpId,
      master_project_title: masterTitle,
    };
  } catch {
    return null;
  }
}
