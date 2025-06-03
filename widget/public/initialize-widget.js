// Vogo.Family Chat Widget Initializer
// This script should be included after the main app script
(function() {
  // Function to initialize the widget
  function initializeWidget() {
    console.log('Initializing Vogo.Family Chat Widget');
    
    // Make sure the root element exists
    if (!document.getElementById('vogo-chat-root')) {
      const root = document.createElement('div');
      root.id = 'vogo-chat-root';
      document.body.appendChild(root);
      console.log('Created vogo-chat-root element');
    }
    
    // Wait for Next.js to be fully loaded
    if (window.__NEXT_LOADED_PAGES__ || window.next) {
      console.log('Next.js detected, waiting for hydration');
      
      // Try to access the VogoWidget component
      if (window.VogoWidget) {
        renderWidget();
      } else {
        // Wait for the component to be available
        let attempts = 0;
        const checkInterval = setInterval(function() {
          attempts++;
          if (window.VogoWidget) {
            clearInterval(checkInterval);
            renderWidget();
          } else if (attempts > 20) {
            clearInterval(checkInterval);
            console.error('Could not find VogoWidget component after multiple attempts');
          }
        }, 200);
      }
    } else {
      // Manually trigger the initialization
      console.log('Manually initializing widget');
      
      // Find the app chunk script and execute it
      const scripts = document.querySelectorAll('script[src*="main-app"]');
      if (scripts.length > 0) {
        console.log('Found main app script, executing');
        
        // Force execution of all chunks
        const appChunks = document.querySelectorAll('script[src*="chunks"]');
        appChunks.forEach(script => {
          const newScript = document.createElement('script');
          newScript.src = script.src;
          document.body.appendChild(newScript);
        });
        
        // Wait a bit and try to render
        setTimeout(function() {
          if (window.VogoWidget) {
            renderWidget();
          } else {
            console.error('VogoWidget component not found after loading scripts');
          }
        }, 1000);
      }
    }
  }
  
  // Function to render the widget
  function renderWidget() {
    console.log('Rendering VogoWidget');
    const rootElement = document.getElementById('vogo-chat-root');
    
    // Create a simple wrapper element for the widget
    const widgetContainer = document.createElement('div');
    widgetContainer.style.position = 'fixed';
    widgetContainer.style.bottom = '20px';
    widgetContainer.style.right = '20px';
    widgetContainer.style.zIndex = '9999';
    rootElement.appendChild(widgetContainer);
    
    // Add the widget to the DOM
    const widgetElement = document.createElement('div');
    widgetElement.id = 'vogo-widget-element';
    widgetContainer.appendChild(widgetElement);
    
    // Execute the widget component's render function
    try {
      if (window.VogoWidget && typeof window.VogoWidget === 'function') {
        // Create a React element and render it
        const React = window.React || (window._next && window._next.React);
        const ReactDOM = window.ReactDOM || (window._next && window._next.ReactDOM);
        
        if (React && ReactDOM) {
          if (ReactDOM.createRoot) {
            // React 18
            const root = ReactDOM.createRoot(widgetElement);
            root.render(React.createElement(window.VogoWidget));
          } else if (ReactDOM.render) {
            // React 17 and below
            ReactDOM.render(React.createElement(window.VogoWidget), widgetElement);
          }
          console.log('Widget rendered successfully');
        } else {
          console.error('React or ReactDOM not found');
        }
      } else {
        console.error('VogoWidget is not a function:', typeof window.VogoWidget);
      }
    } catch (error) {
      console.error('Error rendering widget:', error);
    }
  }
  
  // Wait for the page to be fully loaded
  if (document.readyState === 'complete') {
    initializeWidget();
  } else {
    window.addEventListener('load', initializeWidget);
  }
})();
