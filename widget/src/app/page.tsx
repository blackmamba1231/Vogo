'use client';
import dynamic from "next/dynamic";
import { useEffect } from 'react';

// Dynamically import the widget to avoid SSR issues
const FloatingWidget = dynamic(() => import('@/components/FloatingWidget'), { ssr: false });

export default function Home() {
 
  
  // Handle communication with parent window when embedded
  useEffect(() => {
    // Only run in client side
    if (typeof window === 'undefined') return;
    
    // Check if we're in an iframe
    const isInIframe = window.self !== window.top;
    
    // Setup resize handler for responsive behavior
    const handleResize = () => {
      const isMobile = window.innerWidth < 480;
      
      // Notify parent window about resize if in iframe
      if (isInIframe) {
        window.parent.postMessage({
          type: 'vogo_widget_resize',
          isMobile
        }, '*');
      }
    };
    
    // Initial check
    handleResize();
    
    // Listen for resize events
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return (
    <main className="min-h-screen ">
      {/* The widget itself */}
      <FloatingWidget />
    </main>
  );
}
