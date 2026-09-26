export {};

declare global {
  interface Window {
    Clerk?: {
      load: (options: { publishableKey: string }) => Promise<void>;
      user: {
        id: string;
        fullName: string | null;
        primaryEmailAddress?: { emailAddress: string } | null;
      } | null;
      session: { getToken: () => Promise<string | null> } | null;
      addListener: (callback: () => void) => void;
      mountSignIn: (element: HTMLElement, options: Record<string, unknown>) => void;
      unmountSignIn: (element: HTMLElement) => void;
      mountUserButton: (element: HTMLElement) => void;
      signOut: () => Promise<void>;
    };
  }
}
