/**
 * Exam-module detection helpers — mirrors the pattern in interviewSim.js
 * for NISM Series XV / Module 16 style exam modules.
 *
 * Returns empty Set on any DB error so consumers degrade gracefully when
 * the `is_exam_module` column hasn't been migrated yet.
 */
import { supabase } from '../lib/supabase';

let _examModuleIdsPromise = null;

/** Fetch and cache all master_modules.id where is_exam_module = true. */
export function getExamMasterModuleIds() {
  if (_examModuleIdsPromise) return _examModuleIdsPromise;
  _examModuleIdsPromise = supabase
    .from('master_modules')
    .select('id')
    .eq('is_exam_module', true)
    .then(({ data, error }) => {
      if (error) {
        _examModuleIdsPromise = null;
        return new Set();
      }
      return new Set((data || []).map((m) => m.id));
    })
    .catch(() => {
      _examModuleIdsPromise = null;
      return new Set();
    });
  return _examModuleIdsPromise;
}

/** Check if a master_modules.id is an exam module. */
export async function isExamMasterModule(masterModuleId) {
  if (!masterModuleId) return false;
  try {
    const ids = await getExamMasterModuleIds();
    return ids.has(masterModuleId);
  } catch {
    return false;
  }
}

const _userModuleExamCache = new Map();

/** Resolve a user_modules.id → master_module_id, then check is_exam_module. */
export async function isExamUserModule(userModuleId) {
  if (!userModuleId) return false;
  if (_userModuleExamCache.has(userModuleId)) return _userModuleExamCache.get(userModuleId);
  try {
    const { data } = await supabase
      .from('user_modules')
      .select('master_module_id')
      .eq('id', userModuleId)
      .maybeSingle();
    const flag = await isExamMasterModule(data?.master_module_id);
    _userModuleExamCache.set(userModuleId, flag);
    return flag;
  } catch {
    return false;
  }
}
