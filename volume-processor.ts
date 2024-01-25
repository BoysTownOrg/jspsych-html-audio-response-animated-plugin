class VolumeProcessor extends AudioWorkletProcessor {
  samplesSincePost: number;

  constructor() {
    super();
    this.samplesSincePost = 0;
  }

  process(
    inputs: Float32Array[][],
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    if (inputs.length > 0) {
      const input = inputs[0];
      if (input.length > 0) {
        const channel = input[0];
        if (channel.length > 0) {
          const rms = Math.sqrt(
            channel.reduce((accumulator, x) => accumulator + x * x, 0) /
              channel.length,
          );
          this.samplesSincePost += channel.length;

          if (this.samplesSincePost / sampleRate > 0.125) {
            this.port.postMessage({ rms });
            this.samplesSincePost = 0;
          }
        }
      }
    }
    // from https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process
    // "A processor implementing...[a node that transforms its input]...
    // should return false from the process method to allow the presence of
    // active input nodes and references to the node to determine whether
    // it can be garbage-collected."
    return false;
  }
}

registerProcessor("volume-processor", VolumeProcessor);
