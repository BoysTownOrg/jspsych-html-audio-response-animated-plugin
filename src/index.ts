// copied liberally from https://github.com/jspsych/jsPsych/blob/main/packages/plugin-html-audio-response/src/index.ts
// see license: https://github.com/jspsych/jsPsych/blob/main/license.txt

import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

const info = <const>{
  name: "html-audio-response-animated",
  parameters: {
    stimulus_duration: {
      type: ParameterType.INT,
      default: null,
    },
    recording_duration: {
      type: ParameterType.INT,
      default: 2000,
    },
    show_done_button: {
      type: ParameterType.BOOL,
      default: true,
    },
    recording_light_width: {
      type: ParameterType.STRING,
      default: "200px",
    },
    prompt_text: {
      type: ParameterType.STRING,
      default: "",
    },
    prompt: {
      type: ParameterType.HTML_STRING,
      pretty_name: "Prompt",
      default: null,
    },
    done_button_label: {
      type: ParameterType.STRING,
      default: "Continue",
    },
    record_again_button_label: {
      type: ParameterType.STRING,
      default: "Record again",
    },
    accept_button_label: {
      type: ParameterType.STRING,
      default: "Continue",
    },
    allow_playback: {
      type: ParameterType.BOOL,
      default: false,
    },
    save_audio_url: {
      type: ParameterType.BOOL,
      default: false,
    },
  },
};

type Info = typeof info;

class AnimationStub {
  cancel() {}
}

function clear(parent: HTMLElement) {
  parent.replaceChildren();
}

class HtmlAudioResponseAnimatedPlugin implements JsPsychPlugin<Info> {
  static info = info;
  jsPsych: JsPsych;
  recorder: MediaRecorder;
  rt: number | null;
  recorded_data_chunks;
  animation;
  stimulus_start_time;
  recordingLight: HTMLSpanElement;
  data_available_handler;
  stop_event_handler;
  audio_url;
  response;
  load_resolver;
  start_event_handler;
  recorder_start_time;
  audioContext: AudioContext;
  volumeProcessorNode: AudioWorkletNode;

  constructor(jsPsych: JsPsych) {
    this.jsPsych = jsPsych;
    this.rt = null;
    this.recorded_data_chunks = [];
  }

  trial(display_element: HTMLElement, trial: TrialType<Info>) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      this.jsPsych.pluginAPI.initializeMicrophoneRecorder(stream);
      this.recorder = this.jsPsych.pluginAPI.getMicrophoneRecorder();
      this.audioContext = new AudioContext();
      this.audioContext.audioWorklet
        .addModule("volume-processor.js")
        .then(() => {
          let microphone = this.audioContext.createMediaStreamSource(stream);
          this.volumeProcessorNode = new AudioWorkletNode(
            this.audioContext,
            "volume-processor",
          );
          microphone.connect(this.volumeProcessorNode);

          this.animation = new AnimationStub();
          this.setupRecordingEvents(display_element, trial);
          this.startRecording();
        });
    });
  }

  showDisplay(display_element: HTMLElement, trial: TrialType<Info>) {
    const ro = new ResizeObserver((entries, observer) => {
      this.stimulus_start_time = performance.now();
      observer.unobserve(display_element);
    });
    ro.observe(display_element);
    const content = document.createElement("div");
    content.id = "jspsych-html-audio-response-animated-stimulus";
    content.style.display = "flex";
    content.style.justifyContent = "center";

    const recordingLightContainer = document.createElement("div");
    recordingLightContainer.style.alignSelf = "center";
    recordingLightContainer.style.height = "20px";
    recordingLightContainer.style.width = trial.recording_light_width;
    recordingLightContainer.style.background = "#666666";
    recordingLightContainer.style.overflow = "hidden";
    const outerRecordingLight = document.createElement("span");
    outerRecordingLight.style.display = "block";
    outerRecordingLight.style.width = "100%";
    outerRecordingLight.style.height = "100%";
    this.recordingLight = document.createElement("span");
    this.recordingLight.style.backgroundColor = "#ff0000";
    this.recordingLight.style.display = "block";
    this.recordingLight.style.height = "100%";
    this.recordingLight.style.width = "0%";
    this.recordingLight.style.animationFillMode = "both";
    outerRecordingLight.append(this.recordingLight);
    recordingLightContainer.append(outerRecordingLight);

    const levelIndicatorContainer = document.createElement("div");
    levelIndicatorContainer.style.alignSelf = "center";
    levelIndicatorContainer.style.height = "200px";
    levelIndicatorContainer.style.width = "20px";
    levelIndicatorContainer.style.background = "#666666";
    levelIndicatorContainer.style.overflow = "hidden";
    const outerLevelIndicator = document.createElement("span");
    outerLevelIndicator.style.display = "block";
    outerLevelIndicator.style.width = "100%";
    outerLevelIndicator.style.height = "100%";
    const levelIndicator = document.createElement("span");
    levelIndicator.style.backgroundColor = "#00ff00";
    levelIndicator.style.display = "block";
    levelIndicator.style.height = "0%";
    levelIndicator.style.width = "100%";
    levelIndicator.style.animationFillMode = "both";
    outerLevelIndicator.append(levelIndicator);
    levelIndicatorContainer.append(outerLevelIndicator);

    const spanContainers = document.createElement("div");
    spanContainers.style.display = "grid";
    spanContainers.style.columnGap = "20px";
    recordingLightContainer.style.gridColumn = "1";
    levelIndicatorContainer.style.gridColumn = "2";
    levelIndicatorContainer.style.transform = "rotate(180deg)";

    spanContainers.append(recordingLightContainer);
    spanContainers.append(levelIndicatorContainer);
    content.append(spanContainers);

    clear(display_element);
    display_element.append(content);

    this.volumeProcessorNode.port.onmessage = (event) => {
      levelIndicator.style.height = `${(100 * (event.data.dB + 80)) / 80}%`;
    };

    if (trial.prompt !== null) {
      const parser = new DOMParser();
      const promptDocument = parser.parseFromString(trial.prompt, "text/html");
      display_element.append(promptDocument.body.firstChild);
    } else if (trial.prompt_text !== "") {
      const prompt = document.createElement("p");
      prompt.textContent = trial.prompt_text;
      display_element.append(prompt);
    }
    if (trial.show_done_button) {
      const buttonContainer = document.createElement("p");
      const button = document.createElement("button");
      button.className = "jspsych-btn";
      button.id = "finish-trial";
      button.textContent = trial.done_button_label;
      buttonContainer.append(button);
      display_element.append(buttonContainer);
    }
  }

  hideStimulus(display_element: HTMLElement) {
    const el: HTMLElement = display_element.querySelector(
      "#jspsych-html-audio-response-animated-stimulus",
    );
    if (el) {
      el.style.visibility = "hidden";
    }
  }

  addButtonEvent(display_element: HTMLElement, trial: TrialType<Info>) {
    const btn = display_element.querySelector("#finish-trial");
    if (btn) {
      btn.addEventListener("click", () => {
        const end_time = performance.now();
        this.animation.cancel();
        this.rt = Math.round(end_time - this.stimulus_start_time);
        this.stopRecording().then(() => {
          if (trial.allow_playback) {
            this.showPlaybackControls(display_element, trial);
          } else {
            this.endTrial(display_element, trial);
          }
        });
      });
    }
  }

  setupRecordingEvents(display_element: HTMLElement, trial: TrialType<Info>) {
    this.data_available_handler = (e) => {
      if (e.data.size > 0) {
        this.recorded_data_chunks.push(e.data);
      }
    };
    this.stop_event_handler = () => {
      const data = new Blob(this.recorded_data_chunks, {
        type: "audio/webm",
      });
      this.audio_url = URL.createObjectURL(data);
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const base64 = (reader.result as string).split(",")[1];
        this.response = base64;
        this.load_resolver();
      });
      reader.readAsDataURL(data);
    };
    this.start_event_handler = (e) => {
      // resets the recorded data
      this.recorded_data_chunks.length = 0;
      this.recorder_start_time = e.timeStamp;
      this.showDisplay(display_element, trial);
      this.addButtonEvent(display_element, trial);
      // setup timer for hiding the stimulus
      if (trial.stimulus_duration !== null) {
        this.jsPsych.pluginAPI.setTimeout(() => {
          this.hideStimulus(display_element);
        }, trial.stimulus_duration);
      }
      // setup timer for ending the trial
      this.animation = this.recordingLight.animate(
        [{ width: "0%" }, { width: "100%" }],
        trial.recording_duration,
      );
      this.animation.onfinish = () => {
        // this check is necessary for cases where the
        // done_button is clicked before the timer expires
        if (this.recorder.state !== "inactive") {
          this.stopRecording().then(() => {
            if (trial.allow_playback) {
              this.showPlaybackControls(display_element, trial);
            } else {
              this.endTrial(display_element, trial);
            }
          });
        }
      };
    };
    this.recorder.addEventListener(
      "dataavailable",
      this.data_available_handler,
    );
    this.recorder.addEventListener("stop", this.stop_event_handler);
    this.recorder.addEventListener("start", this.start_event_handler);
  }

  startRecording() {
    this.recorder.start();
  }

  stopRecording() {
    this.recorder.stop();
    return new Promise((resolve) => {
      this.load_resolver = resolve;
    });
  }

  showPlaybackControls(display_element: HTMLElement, trial: TrialType<Info>) {
    display_element.innerHTML = `
      <p><audio id="playback" src="${this.audio_url}" controls></audio></p>
      <button id="record-again" class="jspsych-btn">${trial.record_again_button_label}</button>
      <button id="continue" class="jspsych-btn">${trial.accept_button_label}</button>
    `;
    display_element
      .querySelector("#record-again")
      .addEventListener("click", () => {
        // release object url to save memory
        URL.revokeObjectURL(this.audio_url);
        this.startRecording();
      });
    display_element.querySelector("#continue").addEventListener("click", () => {
      this.endTrial(display_element, trial);
    });
    // const audio = display_element.querySelector('#playback');
    // audio.src =
  }

  endTrial(display_element: HTMLElement, trial: TrialType<Info>) {
    // clear recordering event handler
    this.recorder.removeEventListener(
      "dataavailable",
      this.data_available_handler,
    );
    this.recorder.removeEventListener("start", this.start_event_handler);
    this.recorder.removeEventListener("stop", this.stop_event_handler);
    // kill any remaining setTimeout handlers
    this.jsPsych.pluginAPI.clearAllTimeouts();
    // gather the data to store for the trial
    const trial_data: any = {
      rt: this.rt,
      response: this.response,
      estimated_stimulus_onset: Math.round(
        this.stimulus_start_time - this.recorder_start_time,
      ),
    };
    if (trial.save_audio_url) {
      trial_data.audio_url = this.audio_url;
    } else {
      URL.revokeObjectURL(this.audio_url);
    }
    // clear the display
    display_element.innerHTML = "";
    // move on to the next trial
    this.audioContext.close();
    this.jsPsych.finishTrial(trial_data);
  }
}

export default HtmlAudioResponseAnimatedPlugin;
