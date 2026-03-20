// Popup root component — Phase 1 version.
// Shows a single "Test Download" button to verify the download pipeline works.
// Phase 3 will replace this with the full image grid + naming form UI.

import { useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('');
  // Track how many downloads have been triggered so the user can confirm
  // each click produces a new file (collision-safe naming check).
  const [clickCount, setClickCount] = useState(0);

  const handleTestDownload = () => {
    const nextCount = clickCount + 1;
    setClickCount(nextCount);
    setStatus('Downloading...');

    // Send a DOWNLOAD_FILE message to the background service worker.
    // The background handles the actual chrome.downloads.download() call.
    chrome.runtime.sendMessage(
      {
        type: 'DOWNLOAD_FILE',
        payload: {
          url: 'https://picsum.photos/800/600',
          basename: 'test_photo',
          ext: 'jpg',
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          setStatus(`Failed: ${chrome.runtime.lastError.message}`);
          return;
        }
        if (response?.ok) {
          // Show download ID alongside success so each click is visibly distinct
          setStatus(`Saved! (ID: ${response.downloadId})`);
        } else {
          setStatus(`Failed: ${response?.error ?? 'unknown error'}`);
        }
      },
    );
  };

  return (
    // w-72: fixed popup width; p-4: comfortable padding
    <div className="w-72 p-4">
      <h1 className="text-lg font-semibold mb-3">Photo Extractor</h1>

      <button
        onClick={handleTestDownload}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
      >
        {/* Show click count after first download so user can confirm each triggers a new file */}
        {clickCount > 0 ? `Test Download (${clickCount})` : 'Test Download'}
      </button>

      {/* Show download status below the button */}
      {status && (
        <p className="mt-2 text-sm text-gray-600">{status}</p>
      )}
    </div>
  );
}
