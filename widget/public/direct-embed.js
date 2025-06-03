// Vogo.Family Chat Widget Direct Embed Script
(function() {
  // Wait for the main app script to load
  window.addEventListener('load', function() {
    // Check if React and ReactDOM are available
    if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
      console.error('React or ReactDOM not found. Make sure they are loaded before this script.');
      
      // Load React and ReactDOM if not available
      const loadReact = document.createElement('script');
      loadReact.src = 'https://unpkg.com/react@18/umd/react.production.min.js';
      
      const loadReactDOM = document.createElement('script');
      loadReactDOM.src = 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js';
      
      loadReact.onload = function() {
        document.head.appendChild(loadReactDOM);
      };
      
      loadReactDOM.onload = initWidget;
      document.head.appendChild(loadReact);
    } else {
      initWidget();
    }
  });

  function initWidget() {
    // Make sure the root element exists
    if (!document.getElementById('vogo-chat-root')) {
      const root = document.createElement('div');
      root.id = 'vogo-chat-root';
      document.body.appendChild(root);
    }

    // Try to find the FloatingWidget component in the global scope
    if (window.__NEXT_DATA__ && window.__NEXT_DATA__.props) {
      console.log('Found Next.js data, attempting to render widget');
      
      // Force render the app into the root
      const rootElement = document.getElementById('vogo-chat-root');
      
      // This will attempt to manually trigger the Next.js app initialization
      if (window.next && window.next.router) {
        console.log('Next.js router found, initializing widget');
        window.next.router.ready(() => {
          console.log('Router ready, widget should render');
        });
      }
    } else {
      console.log('Next.js data not found, trying alternative rendering method');
      
      // Alternative method: try to find any exported components
      if (window.VogoWidget || window.FloatingWidget) {
        const WidgetComponent = window.VogoWidget || window.FloatingWidget;
        const rootElement = document.getElementById('vogo-chat-root');
        
        if (typeof ReactDOM.createRoot === 'function') {
          // React 18
          const root = ReactDOM.createRoot(rootElement);
          root.render(React.createElement(WidgetComponent));
        } else if (typeof ReactDOM.render === 'function') {
          // React 17 and below
          ReactDOM.render(React.createElement(WidgetComponent), rootElement);
        }
      }
    }
  }
})();
