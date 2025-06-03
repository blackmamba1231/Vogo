interface WhisperConfig {
  apiKey: string;
  model?: string;
  language?: string;
}

export class WhisperRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private config: WhisperConfig;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  private readonly SILENCE_TIMEOUT = 5000; // 5 seconds of silence to auto-stop

  constructor(config: WhisperConfig) {
    this.config = {
      model: 'whisper-1',
      language: 'en',
      ...config
    };
  }

  private resetSilenceTimer() {
    // Clear existing timer if any
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    // Set new timer
    this.silenceTimer = setTimeout(() => {
      if (this.isRecording) {
        console.log('No speech detected for 5 seconds, stopping recording...');
        this.stopRecording().catch(err => {
          console.error('Error during auto-stop:', err);
        });
      }
    }, this.SILENCE_TIMEOUT);
  }

  async startRecording() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];
      this.isRecording = true;
      this.resetSilenceTimer(); // Start the silence timer

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          // Reset silence timer on new data
          this.resetSilenceTimer();
        }
      };

      this.mediaRecorder.start();
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      this.stopRecording();
      throw new Error('Failed to access microphone. Please ensure you have granted microphone permissions.');
    }
  }

  async stopRecording(): Promise<string> {
    console.log('stopRecording called, state:', {
      isRecording: this.isRecording,
      mediaRecorderState: this.mediaRecorder?.state
    });

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      console.log('No active recording to stop');
      return ''; // Return empty string instead of throwing error
    }

    return new Promise((resolve) => {
      try {
        this.mediaRecorder!.onstop = async () => {
          console.log('MediaRecorder stopped, processing audio chunks...');
          try {
            if (this.audioChunks.length === 0) {
              console.log('No audio data recorded');
              resolve('');
              return;
            }
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            console.log('Audio blob created, size:', audioBlob.size);
            const transcription = await this.transcribeAudio(audioBlob);
            resolve(transcription);
          } catch (error) {
            console.error('Error in onstop handler:', error);
            resolve('');
          } finally {
            this.cleanup();
          }
        };

        // Request final data
        this.mediaRecorder!.requestData();
        
        // Stop the recorder
        if (this.mediaRecorder!.state !== 'inactive') {
          this.mediaRecorder!.stop();
        }
        this.isRecording = false;
      } catch (error) {
        console.error('Error stopping recording:', error);
        this.cleanup();
        resolve('');
      }
    });
  }

  private async transcribeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', this.config.model!);
    formData.append('language', this.config.language!);

    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to transcribe audio');
      }

      const result = await response.json();
      return result.text;
    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error('Failed to transcribe audio. Please try again.');
    }
  }

  private cleanup() {
    console.log('Cleaning up resources...');
    // Clear any existing timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    // Stop all media tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      this.stream = null;
    }
    
    // Clear media recorder
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch (e) {
          console.warn('Error stopping media recorder during cleanup:', e);
        }
      }
      this.mediaRecorder = null;
    }
    
    this.audioChunks = [];
    this.isRecording = false;
  }

  isRecordingNow(): boolean {
    return this.isRecording;
  }
}
