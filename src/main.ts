import { makeMidiMessageFromMidiArray } from "./midi-message";
import generatorProcessorUrl from "./custom-synth-processor?worker&url";
import { customSynthProcessorKey } from "./processor-keys";

function makeOscilator(context: AudioContext) {
  const options: AudioWorkletNodeOptions = {
    processorOptions: { sampleRate: context.sampleRate },
  };
  const oscillatorProcessor = new AudioWorkletNode(
    context,
    customSynthProcessorKey,
    options
  );
  return oscillatorProcessor;
}

async function main() {
  const context = new AudioContext();
  await context.audioWorklet.addModule(generatorProcessorUrl);

  const oscilators = new Map<number, AudioWorkletNode>();
  const midiAccess = await navigator.requestMIDIAccess();
  midiAccess.inputs.forEach((entry) => {
    entry.onmidimessage = (event) => {
      const message = makeMidiMessageFromMidiArray(event.data, event.timeStamp);

      // Create one oscilator per note and cache them.
      const oscillatorProcessor =
        oscilators.get(message.number) ??
        (() => {
          const oscillatorProcessor = makeOscilator(context);
          oscillatorProcessor.connect(context.destination);
          oscilators.set(message.number, oscillatorProcessor);
          return oscillatorProcessor;
        })();

      // Handle the MIDI message inside the oscilator.
      oscillatorProcessor.port.postMessage(message);

      // The context refuzes to play unless `resume` is called in a user input event handler.
      context.resume();
    };
  });
}

main();
