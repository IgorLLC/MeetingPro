import React, { useState, useCallback } from 'react';
import { AudioUploader } from './components/AudioUploader';
import { AudioWaveform } from './components/AudioWaveform';
import { ClientForm } from './components/ClientForm';
import { MinutesDisplay } from './components/MinutesDisplay';
import { AudioProcessor } from './services/audioProcessor';
import { Headphones, FileAudio, ClipboardList, AlertCircle, XCircle } from 'lucide-react';

interface ClientData {
  clientName: string;
  meetingTitle: string;
  date: string;
}

interface Minutes {
  topics: Array<{
    title: string;
    keyPoints: string[];
    actionItems: string[];
  }>;
}

interface ProcessingDetails {
  bitrate?: string;
  sampleRate?: string;
  duration?: string;
  size?: string;
  format?: string;
  stage?: string;
}

interface ProgressStatus {
  stage: 'converting' | 'transcribing' | 'analyzing';
  progress: {
    converting: number;
    transcribing: number;
    analyzing: number;
  };
  details?: ProcessingDetails;
}

function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [minutes, setMinutes] = useState<Minutes | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [audioProcessor, setAudioProcessor] = useState<AudioProcessor | null>(null);
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>({
    stage: 'converting',
    progress: {
      converting: 0,
      transcribing: 0,
      analyzing: 0
    }
  });

  const handleFileSelect = (file: File) => {
    setAudioFile(file);
    setStep(2);
    setError(null);
  };

  const resetState = () => {
    setAudioFile(null);
    setClientData(null);
    setMinutes(null);
    setProcessing(false);
    setError(null);
    setStep(1);
    setAudioProcessor(null);
    setProgressStatus({
      stage: 'converting',
      progress: {
        converting: 0,
        transcribing: 0,
        analyzing: 0
      }
    });
  };

  const handleCancel = useCallback(() => {
    if (audioProcessor) {
      audioProcessor.cancel();
      resetState();
    }
  }, [audioProcessor]);

  const handleClientFormSubmit = async (data: ClientData) => {
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      setError('OpenAI API key is not configured. Please add it to your .env file.');
      return;
    }

    try {
      setProcessing(true);
      setClientData(data);
      setStep(3);
      setError(null);

      const processor = new AudioProcessor((stage, progress, details) => {
        setProgressStatus({
          stage,
          progress,
          details
        });
      });
      setAudioProcessor(processor);

      const wavBlob = await processor.convertToWav(audioFile!);
      const transcription = await processor.transcribeAudio(wavBlob);
      const processedMinutes = await processor.segmentByTopics(transcription);

      setMinutes(processedMinutes);
      setProcessing(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      if (errorMessage === 'Operation cancelled') {
        resetState();
      } else {
        setError(errorMessage);
        setProcessing(false);
      }
    }
  };

  const getProgressMessage = (status: ProgressStatus) => {
    const currentProgress = Math.round(status.progress[status.stage] * 100);
    const getStageProgress = (stage: keyof typeof status.progress) => 
      Math.round(status.progress[stage] * 100);

    return (
      <div className="space-y-4">
        <div className="text-xl font-medium text-gray-900">
          {status.details?.stage || (
            <>
              {status.stage === 'converting' && `Converting audio format... ${currentProgress}%`}
              {status.stage === 'transcribing' && `Transcribing audio to text... ${currentProgress}%`}
              {status.stage === 'analyzing' && `Analyzing content and generating minutes... ${currentProgress}%`}
            </>
          )}
        </div>

        {status.details && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-600">
            {status.details.size && <div>Size: {status.details.size}</div>}
            {status.details.format && <div>Format: {status.details.format}</div>}
            {status.details.bitrate && <div>Bitrate: {status.details.bitrate}</div>}
            {status.details.sampleRate && <div>Sample Rate: {status.details.sampleRate}</div>}
            {status.details.duration && <div>Duration: {status.details.duration}</div>}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Audio Conversion</span>
            <span>{getStageProgress('converting')}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${getStageProgress('converting')}%` }}
            />
          </div>
          
          <div className="flex justify-between text-sm text-gray-600">
            <span>Transcription</span>
            <span>{getStageProgress('transcribing')}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${getStageProgress('transcribing')}%` }}
            />
          </div>
          
          <div className="flex justify-between text-sm text-gray-600">
            <span>Analysis</span>
            <span>{getStageProgress('analyzing')}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${getStageProgress('analyzing')}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Configuration Required</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Please configure your OpenAI API key in the <code className="bg-gray-100 px-2 py-1 rounded">.env</code> file:
          </p>
          <div className="bg-gray-50 p-4 rounded-md">
            <code className="text-sm text-gray-800">
              VITE_OPENAI_API_KEY=your-openai-api-key-here
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Meeting Minutes Generator
          </h1>
          <p className="text-lg text-gray-600">
            Transform your audio recordings into organized meeting minutes
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <div className="flex justify-between mb-8">
            {[
              { icon: FileAudio, label: 'Upload Audio' },
              { icon: Headphones, label: 'Review Audio' },
              { icon: ClipboardList, label: 'Generate Minutes' },
            ].map((s, i) => (
              <div
                key={i}
                className={`flex flex-col items-center ${
                  i + 1 === step ? 'text-indigo-600' : 'text-gray-400'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                    i + 1 === step
                      ? 'bg-indigo-100'
                      : i + 1 < step
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100'
                  }`}
                >
                  <s.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-8">
            {step === 1 && <AudioUploader onFileSelect={handleFileSelect} />}
            
            {step === 2 && audioFile && (
              <div className="space-y-8">
                <AudioWaveform audioFile={audioFile} />
                <div className="border-t pt-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Meeting Details
                  </h3>
                  <ClientForm onSubmit={handleClientFormSubmit} />
                </div>
              </div>
            )}

            {step === 3 && processing && (
              <div className="text-center py-12">
                <div className="space-y-6">
                  {getProgressMessage(progressStatus)}
                  <button
                    onClick={handleCancel}
                    className="mt-6 inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel Processing
                  </button>
                </div>
              </div>
            )}

            {step === 3 && !processing && minutes && clientData && (
              <MinutesDisplay
                minutes={minutes}
                clientName={clientData.clientName}
                meetingTitle={clientData.meetingTitle}
                date={clientData.date}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;