// Vogo.Family Complete Widget Embed
// This script loads all necessary chunks in the correct order with self-invoking wrappers
(function() {
  console.log('Vogo.Family Widget Loader Starting');
  
  // Create the root element if it doesn't exist
  if (!document.getElementById('vogo-chat-root')) {
    const root = document.createElement('div');
    root.id = 'vogo-chat-root';
    root.style.position = 'fixed';
    root.style.bottom = '20px';
    root.style.right = '20px';
    root.style.zIndex = '9999';
    document.body.appendChild(root);
    console.log('Created vogo-chat-root element');
  }

  // Function to load a script with a self-invoking wrapper
  function loadScriptWithWrapper(url) {
    return new Promise((resolve, reject) => {
      console.log(`Fetching: ${url}`);
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
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
      console.log(`Loading CSS: ${url}`);
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

  // Script URLs in the correct loading order
  const cssUrl = 'https://vogo-chatbot.vogo.family/_next/static/css/e60b2bb6c1978960.css';
  const scriptUrls = [
    'https://vogo-chatbot.vogo.family/_next/static/chunks/polyfills-c67a75d1b6f99dc8.js',
    'https://vogo-chatbot.vogo.family/_next/static/chunks/webpack-4cdc0867cc5dd3b0.js',
    'https://vogo-chatbot.vogo.family/_next/static/chunks/framework-8883d1e9be70c3da.js',
    'https://vogo-chatbot.vogo.family/_next/static/chunks/main-f65c66a5c424a4c3.js',
    'https://vogo-chatbot.vogo.family/_next/static/chunks/pages/_app-b555d5e1eab09320.js',
    'https://vogo-chatbot.vogo.family/_next/static/chunks/4bd1b696-640aabc2b96c0448.js',
    'https://vogo-chatbot.vogo.family/_next/static/chunks/684-f668407047b25d15.js',
    'https://vogo-chatbot.vogo.family/_next/static/chunks/main-app-116ab2d175890b3e.js',
    'https://vogo-chatbot.vogo.family/_next/static/chunks/app/page-231765ea69699e49.js'
  ];

  // Create a floating chat button
  function createChatButton() {
    const button = document.createElement('button');
    button.id = 'vogo-chat-button';
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.right = '20px';
    button.style.width = '60px';
    button.style.height = '60px';
    button.style.borderRadius = '50%';
    button.style.backgroundColor = '#30653e';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    button.style.cursor = 'pointer';
    button.style.zIndex = '9999';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    
    // Create a container for the widget
    const container = document.createElement('div');
    container.id = 'vogo-widget-container';
    container.style.position = 'fixed';
    container.style.bottom = '90px';
    container.style.right = '20px';
    container.style.width = '350px';
    container.style.height = '500px';
    container.style.backgroundColor = 'white';
    container.style.borderRadius = '10px';
    container.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    container.style.zIndex = '9998';
    container.style.overflow = 'hidden';
    container.style.display = 'none'; // Initially hidden
    
    // Add them to the page
    document.body.appendChild(button);
    document.body.appendChild(container);
    
    // Toggle widget visibility when button is clicked
    button.addEventListener('click', function() {
      const isVisible = container.style.display !== 'none';
      container.style.display = isVisible ? 'none' : 'block';
    });
    
    return container;
  }

  // Load the CSS first
  loadCSS(cssUrl)
    .then(() => {
      console.log('CSS loaded, now loading scripts in sequence');
      
      // Create the widget container
      const container = createChatButton();
      
      // Load scripts in sequence
      return scriptUrls.reduce((promise, url) => {
        return promise.then(() => loadScriptWithWrapper(url));
      }, Promise.resolve());
    })
    .then(() => {
      console.log('All scripts loaded successfully');
      
      // Create an iframe to load the widget
      const container = document.getElementById('vogo-widget-container');
      if (container) {
        const iframe = document.createElement('iframe');
        iframe.src = 'https://vogo-chatbot.vogo.family';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        container.appendChild(iframe);
        console.log('Iframe created and added to container');
      }
    })
    .catch(error => {
      console.error('Error in loading sequence:', error);
    });
})();
