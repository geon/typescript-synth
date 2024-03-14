export interface Envelope {
	setNoteOff(): void;
	getNextSample(sampleRate: number): number;
}

export type EnvelopeValues = {
	readonly attack: number;
	readonly decay: number;
	readonly sustainLevel: number; // The only non-time value.
	readonly release: number;
};

export type EnvelopeState = {
	value: number;
	stage: "attack" | "decay" | "sustain" | "release" | "done";
	timeLeftOfStage: number;
	releaseStartValue: number;
};

function interpolate(a: number, b: number, ratio: number): number {
	return a + (b - a) * ratio;
}

function easeOut(
	currentValue: number,
	target: number,
	timeLeft: number,
	timeTotal: number,
	exponent: number
): number {
	const ratio = 1 - timeLeft / timeTotal;
	return interpolate(currentValue, target, Math.pow(ratio, 1 / exponent));
}

export class SimpleEnvelope implements Envelope {
	private state: EnvelopeState;

	constructor(private envelope: EnvelopeValues, private startValue = 0) {
		this.state = {
			value: 0,
			stage: "attack",
			timeLeftOfStage: envelope.attack,
			releaseStartValue: 0,
		};
	}

	setNoteOff(): void {
		this.state.stage = "release";
		this.state.timeLeftOfStage = this.envelope.release;
		this.state.releaseStartValue = this.state.value;
	}

	getNextSample(sampleRate: number): number {
		switch (this.state.stage) {
			case "attack": {
				const newValue = easeOut(
					this.startValue,
					1,
					this.state.timeLeftOfStage,
					this.envelope.attack,
					2
				);

				this.state.value = newValue;
				this.state.timeLeftOfStage -= 1 / sampleRate;
				if (this.state.timeLeftOfStage < 0) {
					this.state.stage = "decay";
					this.state.timeLeftOfStage += this.envelope.decay;
				}

				return newValue;
			}

			case "decay": {
				const newValue = easeOut(
					1,
					this.envelope.sustainLevel,
					this.state.timeLeftOfStage,
					this.envelope.decay,
					2
				);

				this.state.value = newValue;
				this.state.timeLeftOfStage -= 1 / sampleRate;
				if (this.state.timeLeftOfStage < 0) {
					this.state.stage = "sustain";
				}

				return newValue;
			}

			case "sustain": {
				return this.envelope.sustainLevel;
			}

			case "release": {
				const newValue = easeOut(
					this.state.releaseStartValue,
					0,
					this.state.timeLeftOfStage,
					this.envelope.release,
					2
				);

				this.state.value = newValue;
				this.state.timeLeftOfStage -= 1 / sampleRate;
				if (this.state.timeLeftOfStage < 0) {
					this.state.stage = "done";
				}

				return newValue;
			}

			case "done":
				return 0;
		}
	}
}
