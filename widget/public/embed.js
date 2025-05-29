/**
 * Vogo Chat Widget Embed Script
 * Add this script to any website to embed the Vogo chat widget
 * 
 * Usage:
 * <script src="https://your-widget-domain.com/embed.js" id="vogo-widget" data-api-url="https://your-backend-url.com"></script>
 */

(function() {
  // Configuration
  const script = document.getElementById('vogo-widget');
  const apiUrl = script ? script.getAttribute('data-api-url') : null;
  
  // Store the API URL in localStorage if provided
  if (apiUrl) {
    localStorage.setItem('vogo_api_url', apiUrl);
  }
  
  // Create widget container
  const container = document.createElement('div');
  container.id = 'vogo-chat-widget-container';
  document.body.appendChild(container);
  
  // Load the widget styles
  const linkElement = document.createElement('link');
  linkElement.rel = 'stylesheet';
  linkElement.href = `${window.location.origin}/widget.css`;
  document.head.appendChild(linkElement);
  
  // Function to load the widget
  const loadWidget = () => {
    // Create iframe for the widget
    const iframe = document.createElement('iframe');
    iframe.id = 'vogo-chat-widget-frame';
    iframe.title = 'Vogo Chat Widget';
    iframe.src = `${window.location.origin}`;
    iframe.style.position = 'fixed';
    iframe.style.bottom = '0';
    iframe.style.right = '0';
    iframe.style.width = '380px';
    iframe.style.height = '580px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '999999';
    iframe.style.overflow = 'hidden';
    iframe.style.transform = 'translate(0, 0)';
    iframe.style.transition = 'transform 0.3s ease';
    
    // Add iframe to container
    container.appendChild(iframe);
    
    // Set up messaging between parent and iframe
    window.addEventListener('message', (event) => {
      // Make sure the message is from our iframe
      if (event.source !== iframe.contentWindow) return;
      
      // Handle various messages from the widget
      switch(event.data.type) {
        case 'vogo_widget_close':
          iframe.style.transform = 'translate(100%, 100%)';
          break;
          
        case 'vogo_widget_open':
          iframe.style.transform = 'translate(0, 0)';
          break;
          
        case 'vogo_widget_resize':
          if (event.data.isMobile) {
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.top = '0';
            iframe.style.left = '0';
          } else {
            iframe.style.width = '380px';
            iframe.style.height = '580px';
            iframe.style.top = 'auto';
            iframe.style.left = 'auto';
          }
          break;
      }
    });
  };
  
  // Load the widget when the page is ready
  if (document.readyState === 'complete') {
    loadWidget();
  } else {
    window.addEventListener('load', loadWidget);
  }
})();
