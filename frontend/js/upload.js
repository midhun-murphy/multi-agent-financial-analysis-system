(function() {
  const checkAuth = () => {
    const token = sessionStorage.getItem('jwt_token') || localStorage.getItem('jwt_token') || document.cookie.split('; ').find(row => row.startsWith('access_token='))?.split('=')[1];
    if (!token) {
      document.documentElement.style.display = 'none';
      window.location.href = 'login.html';
      return;
    }
    
    // Inject auth token for API calls on port 8080
    if (window.location.port === '8080' && !window.fetch.patched) {
      const originalFetch = window.fetch;
      window.fetch = function(input, init) {
        init = init || {};
        init.headers = init.headers || {};
        if (init.headers instanceof Headers) {
          init.headers.set('Authorization', 'Bearer ' + token);
        } else if (Array.isArray(init.headers)) {
          init.headers.push(['Authorization', 'Bearer ' + token]);
        } else {
          init.headers['Authorization'] = 'Bearer ' + token;
        }
        return originalFetch(input, init);
      };
      window.fetch.patched = true;
    }
  };
  checkAuth();
  window.addEventListener('pageshow', checkAuth);
})();

/**
 * upload.js
 * =========
 * Manages the PDF document upload panel interactions
 * and simulates upload and multi-agent pipeline ingestion progress.
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('upload-form');
  const fileSelector = document.getElementById('file-selector');
  const dropzone = document.getElementById('dropzone');
  const dropzoneText = document.getElementById('dropzone-text');
  const progressContainer = document.getElementById('progress-container');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressStatusLabel = document.getElementById('progress-status-label');
  const progressPercentLabel = document.getElementById('progress-percent-label');
  const progressSubText = document.getElementById('progress-sub-text');
  const companyInput = document.getElementById('company-name-input');
  const tickerInput = document.getElementById('ticker-input');
  const submitBtn = document.getElementById('btn-submit');

  // Drag and drop event listeners
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--accent-blue)';
    dropzone.style.background = 'var(--bg-hover)';
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--border-medium)';
    dropzone.style.background = 'var(--bg-card-alt)';
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border-medium)';
    dropzone.style.background = 'var(--bg-card-alt)';
    
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        fileSelector.files = e.dataTransfer.files;
        updateDropzoneWithFile(file.name);
      } else {
        alert('Only PDF files are supported.');
      }
    }
  });

  fileSelector.addEventListener('change', () => {
    if (fileSelector.files.length > 0) {
      updateDropzoneWithFile(fileSelector.files[0].name);
    }
  });

  function updateDropzoneWithFile(filename) {
    dropzoneText.textContent = `Selected: ${filename}`;
    dropzoneText.style.color = 'var(--accent-blue)';
    
    // Autofill simulated helper if file contains name matches
    const nameLower = filename.toLowerCase();
    if (nameLower.includes('apollo')) {
      companyInput.value = 'Apollo Hospitals Enterprise Limited';
      tickerInput.value = 'APOLLOHOSP';
    } else if (nameLower.includes('apple') || nameLower.includes('aapl')) {
      companyInput.value = 'Apple Inc.';
      tickerInput.value = 'AAPL';
    }
  }

  // Handle form submission and simulate pipeline analysis states
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!fileSelector.files.length) {
      alert('Please select a PDF document first.');
      return;
    }

    // Hide input controls and show progress indicator bar
    form.style.opacity = '0.3';
    form.style.pointerEvents = 'none';
    submitBtn.disabled = true;
    progressContainer.style.display = 'flex';

    simulatePipelineAnalysis();
  });

  function simulatePipelineAnalysis() {
    const states = [
      { progress: 10, status: 'Uploading PDF document...', desc: 'Reading file bytes...' },
      { progress: 25, status: 'Extracting text layer...', desc: 'Parsing native document structures...' },
      { progress: 40, status: 'Ingesting tables & ratios...', desc: 'Executing OCR engine fallback overlays...' },
      { progress: 55, status: 'Indexing document vectors...', desc: 'Splitting semantic blocks and writing ChromaDB...' },
      { progress: 70, status: 'CEO Agent dispatching workflow...', desc: 'Orchestrating specialized nodes...' },
      { progress: 85, status: 'Running metrics & ratio extraction...', desc: 'Synthesizing competitor benchmarks...' },
      { progress: 95, status: 'Generating investment recommendation...', desc: 'Writing final executive summary details...' },
      { progress: 100, status: 'Analysis complete!', desc: 'Redirecting to dashboard view...' }
    ];

    let stateIdx = 0;
    
    function tick() {
      if (stateIdx >= states.length) {
        // Simulation finished, load the main index dashboard page
        setTimeout(() => {
          window.location.href = './index.html';
        }, 600);
        return;
      }

      const currentState = states[stateIdx];
      
      // Update DOM labels
      progressBarFill.style.width = `${currentState.progress}%`;
      progressPercentLabel.textContent = `${currentState.progress}%`;
      progressStatusLabel.textContent = currentState.status;
      progressSubText.textContent = currentState.desc;

      stateIdx++;

      // Variables delay timing based on processing complexity
      let delay = 800;
      if (currentState.progress === 40) delay = 1200; // Simulating heavy table processing
      if (currentState.progress === 70) delay = 1500; // Simulating CEO workflow run times

      setTimeout(tick, delay);
    }

    tick();
  }
});
