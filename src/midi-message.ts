// https://github.com/soulfresh/midi-parser
// Code adapted from class-based plain js.

export const STATUS_BYTE = 0xf0;
export const CHANNEL_BYTE = 0x0f;
export const DATA_BYTE = 0x7f;

// Midi message names
export const MessageTypes = {
	NOTE_ON: "noteon",
	NOTE_OFF: "noteoff",
	KEY_PRESSURE: "keypressure",
	CC: "controlchange",
	PROGRAM_CHANGE: "programchange",
	CHANNEL_PRESSURE: "channelpressure",
	PITCH_BEND: "pitchbend",
	UNKNOWN: "unknown",
} as const;

type MessageType = typeof MessageTypes[keyof typeof MessageTypes];

// const messageTypesList = Object.keys(MessageTypes)
// 	.map((key) => MessageTypes[key as keyof typeof MessageTypes])
// 	.filter((key) => key !== "unknown");

// CC mode names
export const CCModes = {
	ALL_SOUNDS_OFF: "allsoundsoff",
	RESET_ALL: "resetallcontrollers",
	LOCAL_CONTROLLER_OFF: "localcontrolleroff",
	LOCAL_CONTROLLER_ON: "localcontrolleron",
	ALL_NOTES_OFF: "allnotesoff",
	OMNI_OFF: "omnimodeoff",
	OMNI_ON: "omnimodeon", // Respond to all midi channels
	MONO_ON: "monomodeon",
	POLY_ON: "polymodeon",
};

// Status byte values that indicate the different midi notes
export const StatusBytes = {
	NOTE_OFF: 0x80,
	NOTE_ON: 0x90,
	KEY_PRESSURE: 0xa0,
	CC: 0xb0,
	PROGRAM_CHANGE: 0xc0,
	CHANNEL_PRESSURE: 0xd0,
	PITCH_BEND: 0xe0,
};

// CC values that indicate special CC Modes.
export const CCModeValues = {
	ALL_SOUNDS_OFF: 120,
	RESET_ALL: 121,
	LOCAL_CONTROLLER: 122,
	ALL_NOTES_OFF: 123,
	OMNI_OFF: 124,
	OMNI_ON: 125,
	MONO_ON: 126,
	POLY_ON: 127,
};

export interface MidiMessage {
	readonly type: MessageType;
	readonly number: number;
	readonly value: number;
	readonly channel: number;
	readonly timestamp: number;
}

/*
 * Parse a MIDI data array like `[144, 60, 23]`
 */
export function makeMidiMessageFromMidiArray(
	data: Uint8Array,
	timestamp: number
): MidiMessage {
	const data_0 = data[0];
	const data_1 = data[1];
	const data_2 = data[2];

	if (data_0 === undefined || data_1 === undefined) {
		throw new Error("Illegal MIDI message of length " + data.length);
	}

	const messageCode = data_0 & STATUS_BYTE;
	const channel = data_0 & CHANNEL_BYTE;
	let number = data_1 & DATA_BYTE;
	let value = data_2 !== undefined ? data_2 & DATA_BYTE : 0;
	let type: MessageType;

	switch (messageCode) {
		case StatusBytes.NOTE_OFF:
			type = MessageTypes.NOTE_OFF;
			value = 0;
			break;

		case StatusBytes.NOTE_ON:
			if (value === 0) {
				type = MessageTypes.NOTE_OFF;
			} else {
				type = MessageTypes.NOTE_ON;
			}
			break;

		case StatusBytes.KEY_PRESSURE:
			type = MessageTypes.KEY_PRESSURE;
			break;

		case StatusBytes.CC:
			type = MessageTypes.CC;
			break;

		case StatusBytes.PROGRAM_CHANGE:
			type = MessageTypes.PROGRAM_CHANGE;
			// TODO Is this supposed to be different?
			number = data_1;
			break;

		case StatusBytes.CHANNEL_PRESSURE:
			type = MessageTypes.CHANNEL_PRESSURE;
			break;

		case StatusBytes.PITCH_BEND:
			type = MessageTypes.PITCH_BEND;
			if (data_2 === undefined) {
				throw new Error("Missing data[2] of MIDI message.");
			}
			var msb = data_2 & DATA_BYTE;
			var lsb = data_1 & DATA_BYTE;
			// number = ((data_2 << 7) + data_1 - 8192) / 8192
			number = (msb << 8) + lsb;
			value = 0;
			break;

		// TODO SysEx, Clock, MTU
		default:
			type = MessageTypes.UNKNOWN;
			number = 0;
			value = 0;
			break;
	}

	return { type, number, value, channel, timestamp };
}
