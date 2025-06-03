// Vogo.Family Chat Widget Loader
(function() {
  // Create widget root if it doesn't exist
  if (!document.getElementById('vogo-chat-root')) {
    const root = document.createElement('div');
    root.id = 'vogo-chat-root';
    document.body.appendChild(root);
  }

  // Get the base URL from this script's src attribute
  const scripts = document.getElementsByTagName('script');
  const currentScript = scripts[scripts.length - 1];
  const baseUrl = currentScript.src.split('/public/widget.js')[0];

  // Fetch the build manifest to get the latest file paths
  fetch(`${baseUrl}/_next/static/manifest.json`)
    .then(response => {
      if (!response.ok) {
        // If manifest doesn't exist, fall back to hardcoded paths
        loadFallbackResources();
        return;
      }
      return response.json();
    })
    .then(manifest => {
      if (!manifest) return;
      
      // Find CSS files
      const cssFiles = Object.values(manifest)
        .filter(path => path.endsWith('.css'))
        .map(path => `${baseUrl}/_next/${path}`);
      
      // Find main app JS file
      const jsFiles = Object.values(manifest)
        .filter(path => path.includes('main-app') && path.endsWith('.js'))
        .map(path => `${baseUrl}/_next/${path}`);
      
      // Load resources
      if (cssFiles.length > 0) {
        loadCSS(cssFiles[0]);
      }
      
      if (jsFiles.length > 0) {
        loadScript(jsFiles[0]);
      }
    })
    .catch(() => {
      // If anything fails, fall back to hardcoded paths
      loadFallbackResources();
    });

  function loadFallbackResources() {
    // These paths should be updated after each deployment
    const cssPath = `${baseUrl}/_next/static/css/6e0e4ec1b0738fb7.css`;
    const jsPath = `${baseUrl}/_next/static/chunks/main-app-116ab2d17589b36.js`;
    
    loadCSS(cssPath);
    loadScript(jsPath);
  }

  function loadCSS(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    document.body.appendChild(script);
  }

  console.log('Vogo.Family Chat Widget initialized');
})();
