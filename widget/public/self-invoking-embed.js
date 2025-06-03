// Vogo.Family Self-Invoking Embed Script
// This script wraps the Next.js chunks in self-invoking functions to ensure proper rendering

(function() {
  // Function to load a script with a self-invoking wrapper
  function loadScriptWithWrapper(url) {
    return new Promise((resolve, reject) => {
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
          }
          return response.text();
        })
        .then(scriptContent => {
          // Create a self-invoking function wrapper
          const wrappedScript = '(function(){' + scriptContent + '})();';
          
          // Create and execute the script
          const scriptElement = document.createElement('script');
          scriptElement.textContent = wrappedScript;
          document.head.appendChild(scriptElement);
          
          console.log(`Script loaded and wrapped: ${url}`);
          resolve();
        })
        .catch(error => {
          console.error(`Error loading script ${url}:`, error);
          reject(error);
        });
    });
  }

  // Function to load CSS
  function loadCSS(url) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = () => {
        console.log(`CSS loaded: ${url}`);
        resolve();
      };
      link.onerror = () => {
        console.error(`Failed to load CSS: ${url}`);
        reject();
      };
      document.head.appendChild(link);
    });
  }

  // Create the root element if it doesn't exist
  if (!document.getElementById('vogo-chat-root')) {
    const root = document.createElement('div');
    root.id = 'vogo-chat-root';
    document.body.appendChild(root);
    console.log('Created vogo-chat-root element');
  }

  // Load the CSS first
  loadCSS('https://vogo-chatbot.vogo.family/_next/static/css/e60b2bb6c1978960.css')
    .then(() => {
      // Then load the scripts in sequence with self-invoking wrappers
      return loadScriptWithWrapper('https://vogo-chatbot.vogo.family/_next/static/chunks/webpack-4cdc0867cc5dd3b0.js');
    })
    .then(() => {
      return loadScriptWithWrapper('https://vogo-chatbot.vogo.family/_next/static/chunks/4bd1b696-640aabc2b96c0448.js');
    })
    .then(() => {
      return loadScriptWithWrapper('https://vogo-chatbot.vogo.family/_next/static/chunks/684-f668407047b25d15.js');
    })
    .then(() => {
      return loadScriptWithWrapper('https://vogo-chatbot.vogo.family/_next/static/chunks/main-app-116ab2d175890b3e.js');
    })
    .then(() => {
      return loadScriptWithWrapper('https://vogo-chatbot.vogo.family/_next/static/chunks/app/page-231765ea69699e49.js');
    })
    .then(() => {
      console.log('All scripts loaded and wrapped successfully');
      
      // After all scripts are loaded, try to initialize the widget
      if (window.React && window.ReactDOM && window.VogoWidget) {
        try {
          const rootElement = document.getElementById('vogo-chat-root');
          if (rootElement) {
            if (window.ReactDOM.createRoot) {
              // React 18
              const root = window.ReactDOM.createRoot(rootElement);
              root.render(window.React.createElement(window.VogoWidget));
            } else if (window.ReactDOM.render) {
              // React 17 and below
              window.ReactDOM.render(window.React.createElement(window.VogoWidget), rootElement);
            }
            console.log('Widget rendered successfully');
          }
        } catch (error) {
          console.error('Error rendering widget:', error);
        }
      } else {
        console.log('React, ReactDOM or VogoWidget not found after loading scripts');
      }
    })
    .catch(error => {
      console.error('Error in script loading sequence:', error);
    });
})();
