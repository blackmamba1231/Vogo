// Fetch and wrap the chunk in a self-invoking function
(function() {
  // Function to load the script content
  function loadScript(url, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          callback(xhr.responseText);
        } else {
          console.error('Failed to load script:', url);
        }
      }
    };
    xhr.send();
  }

  // Function to execute the script with self-invoking wrapper
  function executeScript(scriptContent) {
    try {
      // Create a self-invoking function wrapper
      const wrappedScript = '(function(){' + scriptContent + '})();';
      
      // Execute the wrapped script
      const scriptElement = document.createElement('script');
      scriptElement.textContent = wrappedScript;
      document.head.appendChild(scriptElement);
      
      console.log('Script executed with self-invoking wrapper');
    } catch (error) {
      console.error('Error executing script:', error);
    }
  }

  // Main chunk URL
  const chunkUrl = 'https://vogo-chatbot.vogo.family/_next/static/chunks/4bd1b696-640aabc2b96c0448.js';
  
  // Load and execute the script
  loadScript(chunkUrl, executeScript);
})();
