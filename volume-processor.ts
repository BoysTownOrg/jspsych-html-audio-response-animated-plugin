class VolumeProcessor extends AudioWorkletProcessor {
  samplesSincePost: number;
  squaredSum: number;

  constructor() {
    super();
    this.samplesSincePost = 0;
    this.squaredSum = 0;
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
        this.squaredSum = channel.reduce(
          (accumulator, x) => accumulator + x * x,
          this.squaredSum,
        );
        this.samplesSincePost += channel.length;

        if (this.samplesSincePost / sampleRate > 0.0625) {
          const dB =
            20 * Math.log10(Math.sqrt(this.squaredSum / this.samplesSincePost));
          this.port.postMessage({ dB });
          this.samplesSincePost = 0;
          this.squaredSum = 0;
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
