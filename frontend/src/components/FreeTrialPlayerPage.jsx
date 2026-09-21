/**
 * FreeTrialPlayerPage, thin re-export shim.
 *
 * The FULL landing-page free trial now runs inside `GuestInterviewPlayer`
 * (no signup, no dashboard, no sidebar). This file is kept so the existing
 * lazy import in App.js continues to work without any router changes.
 */
export { default } from './GuestInterviewPlayer';
