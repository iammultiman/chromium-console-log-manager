/**
 * Options page initialization script
 * Separated from HTML to comply with Content Security Policy
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  try {
    // Initialize the options page manager
    window.optionsManager = new OptionsPageManager();
    console.log('Options page initialized successfully');
  } catch (error) {
    console.error('Failed to initialize options page:', error);
    
    // Show error message to user
    const container = document.querySelector('.options-container');
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #d32f2f;">
          <h2>Initialization Error</h2>
          <p>Failed to load the options page. Please try refreshing or check the console for details.</p>
          <p><strong>Error:</strong> ${error.message}</p>
        </div>
      `;
    }
  }
});