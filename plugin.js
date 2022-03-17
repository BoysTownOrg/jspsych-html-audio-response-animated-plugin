function htmlAudioResponseAnimatedPlugin(jsPsychModule) {
  const info = {
    name: "html-audio-response-animated",
    parameters: {
      stimulus_duration: {
        type: jsPsychModule.ParameterType.INT,
        default: null,
      },
      recording_duration: {
        type: jsPsychModule.ParameterType.INT,
        default: 2000,
      },
      show_done_button: {
        type: jsPsychModule.ParameterType.BOOL,
        default: true,
      },
      done_button_label: {
        type: jsPsychModule.ParameterType.STRING,
        default: "Continue",
      },
      record_again_button_label: {
        type: jsPsychModule.ParameterType.STRING,
        default: "Record again",
      },
      accept_button_label: {
        type: jsPsychModule.ParameterType.STRING,
        default: "Continue",
      },
      allow_playback: {
        type: jsPsychModule.ParameterType.BOOL,
        default: false,
      },
      save_audio_url: {
        type: jsPsychModule.ParameterType.BOOL,
        default: false,
      },
    },
  };

  class AnimationStub {
    cancel() {}
  }

  function clear(parent) {
    // https://stackoverflow.com/a/3955238
    while (parent.firstChild) {
      parent.removeChild(parent.lastChild);
    }
  }

  class Plugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
      this.rt = null;
      this.recorded_data_chunks = [];
    }

    trial(display_element, trial) {
      this.recorder = this.jsPsych.pluginAPI.getMicrophoneRecorder();
      this.animation = new AnimationStub();
      this.setupRecordingEvents(display_element, trial);
      this.startRecording();
    }

    showDisplay(display_element, trial) {
      const ro = new ResizeObserver((entries, observer) => {
        this.stimulus_start_time = performance.now();
        observer.unobserve(display_element);
      });
      ro.observe(display_element);
      const content = document.createElement("div");
      content.id = "jspsych-html-audio-response-animated-stimulus";
      const spanContainer = document.createElement("div");
      spanContainer.style.height = "20px";
      spanContainer.style.position = "relative";
      spanContainer.style.width = "200px";
      spanContainer.style.background = "#666666";
      spanContainer.style.overflow = "hidden";
      const outerSpan = document.createElement("span");
      outerSpan.style.display = "block";
      outerSpan.style.width = "100%";
      outerSpan.style.height = "100%";
      this.recordingLight = document.createElement("span");
      this.recordingLight.style.backgroundColor = "#ff0000";
      this.recordingLight.style.display = "block";
      this.recordingLight.style.height = "100%";
      this.recordingLight.style.width = "0%";
      this.recordingLight.style.animationFillMode = "both";
      outerSpan.append(this.recordingLight);
      spanContainer.append(outerSpan);
      content.append(spanContainer);
      clear(display_element);
      display_element.append(content);
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

    hideStimulus(display_element) {
      const el = display_element.querySelector(
        "#jspsych-html-audio-response-animated-stimulus"
      );
      if (el) {
        el.style.visibility = "hidden";
      }
    }

    addButtonEvent(display_element, trial) {
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

    setupRecordingEvents(display_element, trial) {
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
          const base64 = reader.result.split(",")[1];
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
          trial.recording_duration
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
        this.data_available_handler
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

    showPlaybackControls(display_element, trial) {
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
      display_element
        .querySelector("#continue")
        .addEventListener("click", () => {
          this.endTrial(display_element, trial);
        });
      // const audio = display_element.querySelector('#playback');
      // audio.src =
    }

    endTrial(display_element, trial) {
      // clear recordering event handler
      this.recorder.removeEventListener(
        "dataavailable",
        this.data_available_handler
      );
      this.recorder.removeEventListener("start", this.start_event_handler);
      this.recorder.removeEventListener("stop", this.stop_event_handler);
      // kill any remaining setTimeout handlers
      this.jsPsych.pluginAPI.clearAllTimeouts();
      // gather the data to store for the trial
      const trial_data = {
        rt: this.rt,
        response: this.response,
        estimated_stimulus_onset: Math.round(
          this.stimulus_start_time - this.recorder_start_time
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
      this.jsPsych.finishTrial(trial_data);
    }
  }
  Plugin.info = info;
  return Plugin;
}

const jsPsychHtmlAudioResponseAnimated =
  htmlAudioResponseAnimatedPlugin(jsPsychModule);
