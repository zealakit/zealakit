export type SessionUser = {
  name: string;
};

/** Demo session state. Replace with real auth when a backend is available. */
export const session = $state<{ user: SessionUser | null }>({ user: null });

export function signIn(name: string): void {
  session.user = { name };
}

export function signOut(): void {
  session.user = null;
}
