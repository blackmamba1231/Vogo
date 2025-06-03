// Vogo.Family Chat Widget Embed Script
(function() {
  // Create widget root if it doesn't exist
  if (!document.getElementById('vogo-chat-root')) {
    const root = document.createElement('div');
    root.id = 'vogo-chat-root';
    document.body.appendChild(root);
  }

  // Load CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://vogo-chatbot.vogo.family/_next/static/css/e60b2bb6c1978960.css';
  document.head.appendChild(link);

  // Load required scripts in the correct order
  function loadScript(src, callback) {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = callback;
    document.body.appendChild(script);
  }

  // Load the main app script
  loadScript('https://vogo-chatbot.vogo.family/_next/static/chunks/main-app-116ab2d175890b3e.js', function() {
    console.log('Vogo.Family Chat Widget loaded successfully');
  });

  // You may need to load additional scripts if required
  // These are the other scripts found in your page source
  loadScript('https://vogo-chatbot.vogo.family/_next/static/chunks/4bd1b696-640aabc2b96c0448.js', function() {
    loadScript('https://vogo-chatbot.vogo.family/_next/static/chunks/684-f668407047b25d15.js', function() {
      console.log('Vogo.Family Chat Widget dependencies loaded');
    });
  });
})();
