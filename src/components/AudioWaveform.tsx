import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface AudioWaveformProps {
  audioFile: File;
}

export function AudioWaveform({ audioFile }: AudioWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create new AbortController for this instance
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    // Create audio URL
    audioUrlRef.current = URL.createObjectURL(audioFile);

    const initWaveSurfer = async () => {
      try {
        // Cleanup previous instance if it exists
        if (wavesurferRef.current) {
          wavesurferRef.current.destroy();
          wavesurferRef.current = null;
        }

        // Check if operation was aborted
        if (signal.aborted) return;

        const ws = WaveSurfer.create({
          container: containerRef.current!,
          waveColor: '#4F46E5',
          progressColor: '#818CF8',
          cursorColor: '#6366F1',
          barWidth: 2,
          barGap: 1,
          height: 100,
          normalize: true,
          backend: 'WebAudio',
          renderFunction: (channels, ctx) => {
            const { width, height } = ctx.canvas;
            const scale = channels[0].length / width;
            const step = Math.ceil(scale);

            ctx.beginPath();
            channels.forEach((channel) => {
              for (let i = 0; i < width; i++) {
                const min = Math.min(...channel.slice(i * step, (i + 1) * step));
                const max = Math.max(...channel.slice(i * step, (i + 1) * step));
                ctx.moveTo(i, (1 + min) * (height / 2));
                ctx.lineTo(i, (1 + max) * (height / 2));
              }
            });
            ctx.stroke();
          }
        });

        // Check if operation was aborted
        if (signal.aborted) {
          ws.destroy();
          return;
        }

        ws.on('play', () => setIsPlaying(true));
        ws.on('pause', () => setIsPlaying(false));
        ws.on('finish', () => setIsPlaying(false));
        ws.on('ready', () => setIsLoading(false));
        ws.on('error', (err) => {
          console.error('WaveSurfer error:', err);
          setError('Error loading audio. Please try again.');
          setIsLoading(false);
        });

        // Load audio with error handling
        try {
          await ws.load(audioUrlRef.current!);
          if (!signal.aborted) {
            wavesurferRef.current = ws;
          } else {
            ws.destroy();
          }
        } catch (err) {
          if (!signal.aborted) {
            console.error('Audio loading error:', err);
            setError('Failed to load audio. Please try again.');
            setIsLoading(false);
            ws.destroy();
          }
        }
      } catch (err) {
        if (!signal.aborted) {
          console.error('WaveSurfer initialization error:', err);
          setError('Failed to initialize audio player. Please try again.');
          setIsLoading(false);
        }
      }
    };

    initWaveSurfer();

    // Cleanup function
    return () => {
      // Abort any pending operations
      abortControllerRef.current?.abort();
      
      // Cleanup WaveSurfer instance
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      
      // Cleanup audio URL
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [audioFile]);

  const handlePlayPause = () => {
    if (wavesurferRef.current && !isLoading) {
      wavesurferRef.current.playPause();
    }
  };

  const handleRestart = () => {
    if (wavesurferRef.current && !isLoading) {
      wavesurferRef.current.stop();
      setIsPlaying(false);
    }
  };

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 rounded-lg">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
        >
          Try reloading the page
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div 
        ref={containerRef} 
        className={`w-full ${isLoading ? 'opacity-50' : ''}`} 
      />
      <div className="flex justify-center gap-4">
        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          className={`p-2 rounded-full ${
            isLoading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
          } text-white transition-colors`}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </button>
        <button
          onClick={handleRestart}
          disabled={isLoading}
          className={`p-2 rounded-full ${
            isLoading
              ? 'bg-gray-200 cursor-not-allowed'
              : 'bg-gray-200 hover:bg-gray-300'
          } text-gray-700 transition-colors`}
          aria-label="Restart"
        >
          <RotateCcw className="w-6 h-6" />
        </button>
      </div>
      {isLoading && (
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Loading audio waveform...</p>
        </div>
      )}
    </div>
  );
}