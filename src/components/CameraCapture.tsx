'use client';

import { useState, useRef, useEffect } from 'react';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export default function CameraCapture({ isOpen, onClose, onCapture }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Ensure video plays when stream is set
  useEffect(() => {
    if (stream && videoRef.current) {
      const video = videoRef.current;
      
      // Set srcObject if not already set
      if (!video.srcObject) {
        video.srcObject = stream;
      }
      
      // Wait for video to be ready
      const tryPlay = () => {
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('Video is playing successfully');
              })
              .catch((error) => {
                console.error('Error playing video:', error);
                // Try to play again after a short delay
                setTimeout(() => {
                  video.play().catch((err) => {
                    console.error('Retry play failed:', err);
                  });
                }, 200);
              });
          }
        } else {
          // Wait for video to be ready
          video.addEventListener('loadedmetadata', tryPlay, { once: true });
          video.addEventListener('canplay', tryPlay, { once: true });
        }
      };
      
      tryPlay();
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      setError(null);
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera API is not supported in this browser. Please use a modern browser or try uploading a photo instead.');
        return;
      }

      // Check if we're on HTTPS (required for camera access in most browsers)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setError('Camera access requires HTTPS. Please access this site via HTTPS or use localhost.');
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Explicitly play the video
        videoRef.current.play().catch((err) => {
          console.error('Error playing video:', err);
        });
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      let errorMessage = 'Failed to access camera. Please try again.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Camera access denied. Please allow camera permissions in your browser settings and try again.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found on your device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera is already in use by another application. Please close other apps using the camera and try again.';
      } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        errorMessage = 'Camera constraints could not be satisfied. Trying with default settings...';
        // Try again with simpler constraints
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
          return; // Success, don't set error
        } catch (retryErr: any) {
          errorMessage = 'Failed to access camera. Please check your browser permissions.';
        }
      } else if (err.name === 'SecurityError') {
        errorMessage = 'Camera access blocked for security reasons. Please ensure you are using HTTPS or localhost.';
      }
      
      setError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Check if video is ready
    if (video.readyState < 2) {
      console.warn('Video not ready, waiting...');
      video.addEventListener('loadedmetadata', () => {
        capturePhoto();
      }, { once: true });
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;

    // Draw video frame to canvas (mirror it back for the photo)
    context.save();
    context.scale(-1, 1);
    context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    context.restore();

    // Convert canvas to blob, then to File
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `camera-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          onCapture(file);
          stopCamera();
          onClose();
        }
      },
      'image/jpeg',
      0.9 // Quality
    );
  };

  const switchCamera = async () => {
    stopCamera();
    try {
      setError(null);
      // Try to get the current facing mode and switch
      const currentStream = stream;
      const currentTrack = currentStream?.getVideoTracks()[0];
      const currentSettings = currentTrack?.getSettings();
      const currentFacingMode = currentSettings?.facingMode;

      const newFacingMode =
        currentFacingMode === 'user' ? 'environment' : 'user';

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Explicitly play the video
        videoRef.current.play().catch((err) => {
          console.error('Error playing video:', err);
        });
      }
    } catch (err: any) {
      console.error('Error switching camera:', err);
      setError('Failed to switch camera. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="relative w-full h-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 bg-black/50">
          <h3 className="text-white text-lg font-semibold">Take Photo</h3>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Camera View */}
        <div className="flex-1 relative bg-black flex items-center justify-center min-h-0">
          {error ? (
            <div className="text-center p-8 max-w-md">
              <div className="mb-6">
                <svg
                  className="w-16 h-16 mx-auto text-red-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <p className="text-red-400 mb-2 font-semibold">Camera Access Error</p>
              <p className="text-white/80 mb-6 text-sm">{error}</p>
              
              <div className="space-y-3">
                <button
                  onClick={startCamera}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
                
                {(error.includes('denied') || error.includes('Permission')) && (
                  <div className="mt-4 p-4 bg-zinc-800 rounded-lg text-left">
                    <p className="text-white/90 text-sm font-semibold mb-2">How to enable camera access:</p>
                    <ul className="text-white/70 text-xs space-y-1 list-disc list-inside">
                      <li>Click the camera icon in your browser's address bar</li>
                      <li>Select "Allow" for camera permissions</li>
                      <li>Refresh the page and try again</li>
                      <li>Or check your browser settings: Settings → Privacy → Camera</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : stream ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
                style={{ 
                  transform: 'scaleX(-1)', // Mirror the video for better UX
                  minHeight: '100%',
                  minWidth: '100%'
                }}
                onLoadedMetadata={() => {
                  console.log('Video metadata loaded');
                  if (videoRef.current) {
                    videoRef.current.play().catch((err) => {
                      console.error('Error in onLoadedMetadata play:', err);
                    });
                  }
                }}
                onCanPlay={() => {
                  console.log('Video can play');
                  if (videoRef.current) {
                    videoRef.current.play().catch((err) => {
                      console.error('Error in onCanPlay play:', err);
                    });
                  }
                }}
              />
              <canvas ref={canvasRef} className="hidden" />
            </>
          ) : (
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white/80">Starting camera...</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex-shrink-0 flex items-center justify-center gap-4 p-6 bg-black/50">
          <button
            onClick={switchCamera}
            disabled={!stream || !!error}
            className="p-3 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Switch camera"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          <button
            onClick={capturePhoto}
            disabled={!stream || !!error}
            className="w-16 h-16 bg-white rounded-full border-4 border-zinc-300 hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            title="Capture photo"
          >
            <div className="w-12 h-12 bg-white rounded-full border-2 border-zinc-400"></div>
          </button>

          <div className="w-12"></div> {/* Spacer for centering */}
        </div>
      </div>
    </div>
  );
}

