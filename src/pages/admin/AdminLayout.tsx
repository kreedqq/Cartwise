/**
 * AdminLayout — thin pass-through kept for legacy import compatibility.
 * The admin chrome (sidebar, topbar, full-screen layout) is now provided
 * by AdminShell, which is rendered directly by the router.
 *
 * This file is no longer the top-level admin wrapper; it simply re-exports
 * AdminShell so that any lingering dynamic imports resolve correctly.
 */
export { default } from "./AdminShell";
