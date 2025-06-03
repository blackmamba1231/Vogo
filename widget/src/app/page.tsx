'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

// Import the FloatingWidget component with SSR disabled
const FloatingWidget = dynamic(() => import('@/components/FloatingWidget'), {
  ssr: false,
});

// Declare global window interface extension
declare global {
  interface Window {
    VogoWidget: any;
  }
}

export default function Home() {
  useEffect(() => {
    // Export the component globally for direct embedding
    if (typeof window !== 'undefined') {
      window.VogoWidget = FloatingWidget;
    }
    
    // Handle communication with parent window (if in iframe)
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'resize') {
        // Send height to parent window
        if (window.parent !== window) {
          window.parent.postMessage(
            { height: document.body.scrollHeight },
            '*'
          );
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Initial height message
    if (window.parent !== window) {
      window.parent.postMessage(
        { height: document.body.scrollHeight },
        '*'
      );
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <FloatingWidget />
    </main>
  );
}
