import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LogOut, ArrowLeft, ArrowRight, Sun, Moon, Sparkles, Trash2, Plus, ArrowUpDown,
  CheckCircle2, AlertCircle, RefreshCw, Loader2, ChevronRight, Lock,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LOADING_STEPS = [
  'Analyzing your knowledge levels...',
  'Identifying gaps and opportunities...',
  'Optimizing your learning sequence...',
];

function ActionBadge({ action }) {
  const config = {
    remove_module: { label: 'Removed', icon: Trash2, cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
    remove_session: { label: 'Removed', icon: Trash2, cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
    add_session: { label: 'AI Added', icon: Plus, cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    reorder_module: { label: 'Reordered', icon: ArrowUpDown, cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  };
  const c = config[action] || config.remove_module;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${c.cls}`}>
      <Icon size={10} /> {c.label}
    </span>
  );
}


// PreviewPage is intentionally a thin redirect now. The product decision was
// made to skip the question/LLM customisation flow and enroll users into the
// full master path 1:1. Anyone landing here from a stale link bounces back to
// the course details page and clicks "Enroll" from there.
export default function PreviewPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/course/${courseId}`, { replace: true });
  }, [courseId, navigate]);
  return null;
}
