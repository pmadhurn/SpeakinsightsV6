import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import App from './App';
import { clerkAuthEnabled } from './auth/clerkBridge';
import './index.css';

// Vite exposes VITE_* env vars through import.meta.env
const clerkPk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

// Ambient declaration augmentation so TS knows the field
declare global {
  interface ImportMetaEnv {
    readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  }
}

const appTree = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {clerkAuthEnabled && clerkPk ? (
      <ClerkProvider publishableKey={clerkPk}>{appTree}</ClerkProvider>
    ) : (
      appTree
    )}
  </React.StrictMode>
);
