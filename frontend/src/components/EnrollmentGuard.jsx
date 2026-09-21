import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

/**
 * Enrollment gating is temporarily disabled per product decision, payment /
 * paywall / customization flows were removed and every authenticated user is
 * treated as enrolled by default. This component is now a pass-through so
 * /dashboard and other Learning routes render instantly with no "Checking
 * your enrollment…" spinner. The prior enrollment check + redirect logic is
 * preserved in git history and can be re-enabled by reverting this file.
 */
export default function EnrollmentGuard({ children }) {
  return children;
}
