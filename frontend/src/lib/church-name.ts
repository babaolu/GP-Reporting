const STORAGE_KEY = 'gp_church_name';
const DEFAULT_NAME = import.meta.env.VITE_CHURCH_NAME || 'GracePlace';

export function getChurchName(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_NAME;
}

export function setChurchName(name: string): void {
  localStorage.setItem(STORAGE_KEY, name.trim());
  // Dispatch a custom event so all open components can react
  window.dispatchEvent(new CustomEvent('churchNameChanged', { detail: name.trim() }));
}
