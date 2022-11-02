import { Envelope, SimpleEnvelope } from "./envelope";
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

class SineOscilator implements Oscilator {
	private readonly oscilator: LinearOscilator;

	constructor(periodRatio: number, frequency: number) {
		this.oscilator = new LinearOscilator(periodRatio, frequency);
	}

	setFrequency(frequency: number): void {
		this.oscilator.setFrequency(frequency);
	}

	getNextSample(sampleRate: number): number {
		return Math.sin(this.oscilator.getNextSample(sampleRate) * Math.PI * 2);
	}
}

class VibratoOscilator implements Oscilator {
	private readonly oscilator: Oscilator;
	private readonly lfo: Oscilator;
	private baseFrequency: number;

	constructor(periodRatio: number, frequency: number) {
		this.oscilator = new LinearOscilator(periodRatio, frequency);
		this.lfo = new SineOscilator(0, 5);
		this.baseFrequency = frequency;
	}

	setFrequency(frequency: number): void {
		this.baseFrequency = frequency;
	}

	getNextSample(sampleRate: number): number {
		this.oscilator.setFrequency(
			this.baseFrequency +
				(this.lfo.getNextSample(sampleRate) * this.baseFrequency) / 100
		);
		return this.oscilator.getNextSample(sampleRate);
	}
}

class GeneratorProcessor extends AudioWorkletProcessor {
	readonly sampleRate: number;
	toneOscilator: Oscilator | undefined;
	envelope: Envelope | undefined;

	constructor({
		processorOptions,
	}: {
		processorOptions: { sampleRate: number };
	}) {
		super();
		this.sampleRate = processorOptions.sampleRate;
		this.port.onmessage = (event: MessageEvent<MidiMessage>): void => {
			if (event.data.type === "noteon") {
				this.toneOscilator = new VibratoOscilator(
					0,
					frequencyFromMidiNoteNumber(event.data.number)
				);
				this.envelope = new SimpleEnvelope({
					// attack: 0.05,
					// decay: 0.5,
					// sustainLevel: 0.75,
					// release: 0.5,
					attack: 1,
					decay: 2,
					sustainLevel: 0.75,
					release: 1,
				});
			}
			if (event.data.type === "noteoff") {
				this.envelope?.setNoteOff();
			}
		};
	}

	process(
		_inputs: Float32Array[][],
		outputs: Float32Array[][],
		_parameters: Record<string, Float32Array>
	) {
		if (this.toneOscilator === undefined || this.envelope == undefined) {
			return true;
		}

		const channel = outputs[0]?.[0];
		if (!channel) {
			throw new Error("Missing channel.");
		}

		for (let i = 0; i < channel.length; i++) {
			channel[i] =
				this.toneOscilator.getNextSample(this.sampleRate) *
				this.envelope.getNextSample(this.sampleRate) *
				0.3;
		}

		return true;
	}
}

registerProcessor(customSynthProcessorKey, GeneratorProcessor);
