import { MidiMessage } from "./midi-message";
import { customSynthProcessorKey } from "./processor-keys";

function frequencyFromMidiNoteNumber(noteNumber: number): number {
	return 440 * Math.pow(2, (noteNumber - 69) / 12);
}

interface Oscilator {
	setFrequency(frequency: number): void;
	getNextSample(sampleRate: number): number;
}

class LinearOscilator implements Oscilator {
	constructor(private periodRatio: number, private frequency: number) {}

	setFrequency(frequency: number): void {
		this.frequency = frequency;
	}

	getNextSample(sampleRate: number): number {
		const deltaPeriodRatio = this.frequency / sampleRate;
		this.periodRatio += deltaPeriodRatio;
		if (this.periodRatio >= 1) {
			this.periodRatio -= 1;
		}

		return this.periodRatio;
	}
}

class GeneratorProcessor extends AudioWorkletProcessor {
	readonly sampleRate: number;
	toneOscilator: Oscilator | undefined;

	constructor({
		processorOptions,
	}: {
		processorOptions: { sampleRate: number };
	}) {
		super();
		this.sampleRate = processorOptions.sampleRate;
		this.port.onmessage = (event: MessageEvent<MidiMessage>): void => {
			if (event.data.type === "noteon") {
				this.toneOscilator = new LinearOscilator(
					0,
					frequencyFromMidiNoteNumber(event.data.number)
				);
			}
			if (event.data.type === "noteoff") {
				this.toneOscilator = undefined;
			}
		};
	}

	process(
		_inputs: Float32Array[][],
		outputs: Float32Array[][],
		_parameters: Record<string, Float32Array>
	) {
		if (this.toneOscilator === undefined) {
			return true;
		}

		const channel = outputs[0]?.[0];
		if (!channel) {
			throw new Error("Missing channel.");
		}

		for (let i = 0; i < channel.length; i++) {
			const sample = this.toneOscilator.getNextSample(this.sampleRate);
			channel[i] = sample * 0.3;
		}

		return true;
	}
}

registerProcessor(customSynthProcessorKey, GeneratorProcessor);