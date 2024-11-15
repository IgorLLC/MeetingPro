import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import OpenAI from 'openai';

const FFMPEG_CORE_VERSION = '0.12.6';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

type ProcessStage = 'converting' | 'transcribing' | 'analyzing';

interface ProcessingProgress {
  converting: number;
  transcribing: number;
  analyzing: number;
}

interface ProcessingDetails {
  bitrate?: string;
  sampleRate?: string;
  duration?: string;
  size?: string;
  format?: string;
  stage?: string;
}

type ProgressCallback = (
  stage: ProcessStage,
  progress: ProcessingProgress,
  details?: ProcessingDetails
) => void;

export class AudioProcessor {
  private ffmpeg: FFmpeg;
  private initialized: boolean = false;
  private abortController: AbortController | null = null;
  private onProgress: ProgressCallback;
  private progress: ProcessingProgress = {
    converting: 0,
    transcribing: 0,
    analyzing: 0
  };

  constructor(onProgress: ProgressCallback) {
    this.ffmpeg = new FFmpeg();
    this.onProgress = onProgress;
  }

  private updateProgress(
    stage: ProcessStage,
    value: number,
    details?: ProcessingDetails
  ) {
    this.progress[stage] = Math.min(1, Math.max(0, value));
    this.onProgress(stage, { ...this.progress }, details);
  }

  async cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.ffmpeg) {
      await this.ffmpeg.terminate();
      this.initialized = false;
    }
  }

  private async ensureFFmpeg() {
    if (this.initialized && this.ffmpeg) return this.ffmpeg;

    try {
      this.ffmpeg = new FFmpeg();
      
      this.ffmpeg.on('progress', ({ progress, time }) => {
        this.updateProgress('converting', progress, {
          stage: 'Processing audio',
          duration: time ? `${Math.round(time * 100) / 100}s processed` : undefined
        });
      });

      this.ffmpeg.on('log', ({ message }) => {
        const bitrateMatch = message.match(/bitrate=\s*(\d+\.\d+|\d+)\s*kbits\/s/);
        if (bitrateMatch) {
          this.updateProgress('converting', this.progress.converting, {
            stage: 'Processing audio',
            bitrate: `${bitrateMatch[1]} kbps`
          });
        }
      });

      const baseURL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;
      
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
      });
      
      this.initialized = true;
      return this.ffmpeg;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('aborted')) {
          throw new Error('Operation cancelled');
        }
        if (error.message.includes('failed to fetch')) {
          throw new Error('Failed to load audio processing components. Please check your internet connection.');
        }
      }
      throw new Error('Failed to initialize audio processing. Please try again.');
    }
  }

  async convertToWav(audioFile: File): Promise<Blob> {
    this.abortController = new AbortController();
    
    try {
      const ffmpeg = await this.ensureFFmpeg();
      
      if (this.abortController.signal.aborted) {
        throw new Error('Operation cancelled');
      }

      const inputFileName = 'input' + audioFile.name.substring(audioFile.name.lastIndexOf('.'));
      const outputFileName = 'output.wav';

      await ffmpeg.writeFile(inputFileName, await fetchFile(audioFile));
      
      // Convert to WAV with progress tracking
      await ffmpeg.exec([
        '-i', inputFileName,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        '-progress', 'pipe:1',
        outputFileName
      ]);

      const outputData = await ffmpeg.readFile(outputFileName);
      
      // Cleanup
      await ffmpeg.rm(inputFileName);
      await ffmpeg.rm(outputFileName);
      
      return new Blob([outputData], { type: 'audio/wav' });
    } catch (error) {
      if (error instanceof Error && error.message === 'Operation cancelled') {
        throw error;
      }
      throw new Error('Failed to convert audio: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    if (this.abortController?.signal.aborted) {
      throw new Error('Operation cancelled');
    }

    try {
      this.updateProgress('transcribing', 0.1);
      
      const transcription = await openai.audio.transcriptions.create({
        file: audioBlob,
        model: 'whisper-1',
        language: 'auto'
      });

      this.updateProgress('transcribing', 1);
      return transcription.text;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error('Invalid or missing OpenAI API key. Please check your environment variables.');
        }
      }
      throw new Error('Failed to transcribe audio: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async segmentByTopics(transcription: string): Promise<any> {
    if (this.abortController?.signal.aborted) {
      throw new Error('Operation cancelled');
    }

    try {
      this.updateProgress('analyzing', 0.1);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a meeting minutes expert. Analyze the transcription and segment it into topics, identifying action items and key points. Support both English and Spanish content."
          },
          {
            role: "user",
            content: `Please analyze this meeting transcription and return a JSON with topics, key points, and action items: ${transcription}`
          }
        ],
        response_format: { type: "json_object" }
      });

      this.updateProgress('analyzing', 1);
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error('Invalid or missing OpenAI API key. Please check your environment variables.');
        }
      }
      throw new Error('Failed to analyze transcription: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}