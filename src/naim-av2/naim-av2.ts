import { debug } from "debug";
import { EventEmitter } from "events";
import { NaimAV2Commands, NaimAV2Responses } from "./naim-av2-commands";
import { NaimAV2Port } from "./naim-av2-port";
import { NaimAV2CurrentDecodeMode, NaimAV2CurrentInput, NaimAV2InputLabel, NaimAV2SpeakerSize, NaimAV2State } from "./naim-av2-state";
import { CecMonitor, LogicalAddress, OperationCode, ParsedPacket, UserControlButton } from "hdmi-cec";

const log = debug('pi-naim-av2:naim-av2');

/**
 * Options passed to the NaimAV2 constructor
 */
export interface NaimAV2Options {
    comPort: string; // com port the AV2 is connected to eg. '/dev/ttyUSB0'
    osdName: string; // The OSD display name eg. 'AV2'
    tvInput: NaimAV2CurrentInput; // The input the TV is connected to eg. 'OP1'
}

const defaultOptions: NaimAV2Options = {
    comPort: '/dev/ttyUSB0',
    osdName: 'Naim AV2',
    tvInput: 'OP1'
};

export enum NaimAV2StartupState {
    NONE = 0,
    GOT_SYSTEM = 1,
    GOT_INPUT = 2,
    GOT_SPEAKER = 4,
    GOT_SOFTWARE = 8,
    GOT_FIRMWARE = 16,
    GOT_EXTRA = 32,
    READY = 64,
}

/**
 * A High-level wrapper around the NaimAV2Port serial port connectivity class, allowing users
 * to get human-readable data about the AV2 and interact with it using sensible method names
 * and values.
 * 
 * Usage:
 * 
 *     const av2 = new NaimAV2({
 *         comPort: '/dev/ttyUSB0'
 *     });
 *     av2.on('stateChange', (state: NaimAV2State) => {
 *         console.log('AV2 async state:', state);
 *     });
 *     av2.setInput('OP1');
 *     console.log('AV2 sync state:', av2.getState());
 *     console.log('AV2 power state:', av2.getPower());
 * 
 * Events:
 * stateChange - emits new and previous states
 * ready - all status bytes received from the unit on startup
 */

export class NaimAV2 extends EventEmitter {

    protected port: NaimAV2Port;
    protected cec: CecMonitor;

    protected started: NaimAV2StartupState = NaimAV2StartupState.NONE;

    protected volumeChangeTimeout: NodeJS.Timeout | null = null;

    protected state: NaimAV2State = {
        system: {
            power: false,
            inputMenu: false,
            speakerMenu: false,
            display: false,
            dolbyDigital: false,
            dolbyPLII: false,
            dts: false,
            stereo: false,
            midnightMode: false,
            bassMix: false,
            cineEq: false,
            verbose: false,
            mute: false,
            volume: 0, // int 0..99
            currentInput: 'OP1',
            currentDecodeMode: 'Stereo'
        },
        input: {
            vip1InputLabel: '---',
            vip2InputLabel: '---',
            an3InputLabel: '---',
            an4InputLabel: '---',
            an5InputLabel: '---',
            an6InputLabel: '---',
            co1InputLabel: '---',
            co2InputLabel: '---',
            op1InputLabel: '---',
            op2InputLabel: '---',
            panorama: false,
            panoramaWidth: 0,
            panoramaDepth: 0
        },
        speaker: {
            speakerSizeMain: 'Large',
            speakerSizeCentre: 'Large',
            speakerSizeSurround: 'Large',
            speakerSizeRear: 'Large',
            subwoofer: false,
            units: 'Metres',
            speakerDistanceLeft: 0,
            speakerDistanceCentre: 0,
            speakerDistanceRight: 0,
            speakerDistanceRightSurround: 0,
            speakerDistanceRightRear: 0,
            speakerDistanceLeftRear: 0,
            speakerDistanceLeftSurround: 0,
            speakerDistanceSubwoofer: 0,
            speakerLevelLeft: 0,
            speakerLevelCentre: 0,
            speakerLevelRight: 0,
            speakerLevelRightSurround: 0,
            speakerLevelRightRear: 0,
            speakerLevelLeftRear: 0,
            speakerLevelLeftSurround: 0,
            speakerLevelSubwoofer: 0
        },
        software: {
            softwareVersion: ''
        },
        firmware: {
            firmwareVersion: ''
        },
        extra: {}
    };

    constructor(
        options: NaimAV2Options = defaultOptions
    ) {
        super();
        
        this.port = this.createNaimAV2(options);

        const { osdName, tvInput } = options;

        // We need to use monitor mode as CecMonitor appears to have an issue comparing
        // sources/targets otherwise
        this.cec = new CecMonitor(osdName, LogicalAddress.AUDIOSYSTEM, true);

        // If the TV sets itself to active source, tell it we are using System Audio Mode
        // (instructs TV to not keep track of volume itself)
        // Also make sure the power is on, and the input is set correctly.
        this.cec.on('ACTIVE_SOURCE', (packet: ParsedPacket, source: number) => {
            log('ACTIVE_SOURCE  - %j (%s)', packet, source);
            this.cec.executeOperation(
                LogicalAddress.BROADCAST,
                OperationCode.SYSTEM_AUDIO_MODE_STATUS,
                [0x01]
            );
            this.cec.executeOperation(
                LogicalAddress.TV,
                OperationCode.GIVE_AUDIO_STATUS
            );
            if (!this.getPower()) {
                this.setPower(true);
            }
            if (this.getInput() !== tvInput) {
                this.setInput(tvInput);
            }
        });

        // If the TV sends a standby message, and we're on it's input, turn off
        this.cec.on('op.STANDBY', (key: string, packet: ParsedPacket) => {
            if (packet.target !== LogicalAddress.AUDIOSYSTEM && packet.target !== LogicalAddress.BROADCAST) {
                log('STANDBY ignored - %j', packet);
                return;
            }
            if (this.getInput() != options.tvInput) {
                log('STANDBY ignored - AV2 not on TV input - %j', packet);
                return;
            }
            log('STANDBY - %j', packet);
            if (this.getPower()) {
                this.setPower(false);
            }
        });

        // If the TV reports it is on, and the AV2 is off, turn the AV2 on.
        // If the TV reports it's off, and the AV2 is on, AND we're on the TV input, turn the AV2 off.
        this.cec.on('op.REPORT_POWER_STATUS', (key: string, packet: ParsedPacket, status: number) => {
            const STATUS_OFF = 1;
            if (packet.source !== LogicalAddress.TV) {
                log('REPORT_POWER_STATUS ignored - %j', packet);
                return;
            }
            if (packet.target !== LogicalAddress.AUDIOSYSTEM && packet.target !== LogicalAddress.BROADCAST) {
                log('REPORT_POWER_STATUS ignored - %j', packet);
                return;
            }
            if (status != STATUS_OFF && !this.getPower()) {
                log('REPORT_POWER_STATUS turning AV2 on');
                this.setPower(true);
                return;
            }
            if (status == STATUS_OFF && this.getPower() && this.getInput() == options.tvInput) {
                log('REPORT_POWER_STATUS turning AV2 off');
                this.setPower(false);
                return;
            }
        });

        this.cec.on('op.USER_CONTROL_PRESSED', (key: string, packet: ParsedPacket, button: UserControlButton) => {
            if (packet.target !== LogicalAddress.AUDIOSYSTEM && packet.target !== LogicalAddress.BROADCAST) {
                log('BUTTON ignored - %n', button);
                return;
            }
            if (button === UserControlButton.VOLUME_UP) {
                log('BUTTON - volume up');
                this.incrementVolume();
                return;
            }
            if (button === UserControlButton.VOLUME_DOWN) {
                log('BUTTON - volume down');
                this.decrementVolume();
                return;
            }
            log('BUTTON not implemented - %n', button);
        });

        // Request active source
        this.cec.executeBroadcastOperation(OperationCode.REQUEST_ACTIVE_SOURCE);

        this.on('stateChange', (state: NaimAV2State, prevState: NaimAV2State) => {
            const allStarted = NaimAV2StartupState.GOT_SYSTEM |
                NaimAV2StartupState.GOT_INPUT |
                NaimAV2StartupState.GOT_SPEAKER |
                NaimAV2StartupState.GOT_SOFTWARE |
                NaimAV2StartupState.GOT_FIRMWARE;
            if (this.started >= allStarted && this.started != NaimAV2StartupState.READY) {
                log('Syncing with CEC...');
                this.started = NaimAV2StartupState.READY;
                this.emit('ready');
            }
        });
    }

    protected createNaimAV2(options: NaimAV2Options): NaimAV2Port {
        const port = new NaimAV2Port({
            comPort: options.comPort
        });

        // Incoming packets update the internal state
        port.on('command', (command: string) => {
            log('Command received by NaimAV2: ' + command);
            this.processAV2Response(command);
        });

        // Tell the AV2 to send back verbose responses
        // This ensures each command that changes a setting triggers a response back that updates the internal state.
        port.on('ready', () => {
            this.setVerbose(true);

            // Get all initial state from the AV2
            this.port.sendCommand(NaimAV2Commands.STATUS_QUERY);
            this.port.sendCommand(NaimAV2Commands.INPUT_MENU_QUERY);
            this.port.sendCommand(NaimAV2Commands.SPEAKER_MENU_QUERY);
            this.port.sendCommand(NaimAV2Commands.SOFTWARE_VERSION_QUERY);
            this.port.sendCommand(NaimAV2Commands.FIRMWARE_VERSION_QUERY);
            this.port.sendCommand(NaimAV2Commands.EXTRA_STATUS_QUERY);    
        });

        return port;
    }

    /**
     * Get the entire current state of the AV2; mostly useful for debugging
     */
    public getState(): NaimAV2State {
        // Return by copy so external applications can't alter the internal state
        return {
            system: {...this.state.system},
            input: {...this.state.input},
            speaker: {...this.state.speaker},
            software: {...this.state.software},
            firmware: {...this.state.firmware},
            extra: {...this.state.extra}
        };
    }

    /**
     * Returns whether the AV2 is powered up or not
     */
    public getPower() {
        return this.state.system.power;
    }

    /**
     * Set the AV2 power to a specified state; true = on, false = off
     */
    public setPower(power: boolean) {
        if (power && !this.state.system.power) {
            this.port.sendCommand(NaimAV2Commands.ON);
            this.state.system.power = true;
            return;
        }
        if (!power && this.state.system.power) {
            this.port.sendCommand(NaimAV2Commands.STANDBY);
            this.state.system.power = false;
            return;
        }
    }

    /**
     * Returns whether the AV2 is in Mute state or not
     */
    public getMute() {
        return this.state.system.mute;
    }

    /**
     * Set Mute state; true = on, false = off
     */
    public setMute(mute: boolean) {
        if (mute && !this.state.system.mute) {
            this.port.sendCommand(NaimAV2Commands.MUTE_ON);
            this.state.system.mute = true;
            return;
        }
        if (!mute && this.state.system.mute) {
            this.port.sendCommand(NaimAV2Commands.MUTE_OFF);
            this.state.system.mute = false;
            return;
        }
    }

    /**
     * Returns whether the AV2 Display is on
     */
    public getDisplay() {
        return this.state.system.display;
    }

    /**
     * Set the AV2 display state; true = on, false = off
     */
    public setDisplay(display: boolean) {
        if (display && !this.state.system.display) {
            this.port.sendCommand(NaimAV2Commands.DISPLAY_ON);
            this.state.system.display = true;
            return;
        }
        if (!display && this.state.system.display) {
            this.port.sendCommand(NaimAV2Commands.DISPLAY_OFF);
            this.state.system.display = false;
            return;
        }
    }

    /**
     * Returns whether the AV2 is in Midnight Mode
     */
    public getMidnightMode() {
        return this.state.system.midnightMode;
    }

    /**
     * Set whether the AV2 should be in Midnight Mode; true = on, false = off
     */
    public setMidnightMode(midnightMode: boolean) {
        if (midnightMode && !this.state.system.midnightMode) {
            this.port.sendCommand(NaimAV2Commands.MIDNIGHT_ON);
            this.state.system.midnightMode = true;
            return;
        }
        if (!midnightMode && this.state.system.midnightMode) {
            this.port.sendCommand(NaimAV2Commands.MIDNIGHT_OFF);
            this.state.system.midnightMode = false;
            return;
        }
    }

    /**
     * Returns whether the AV2 has Bass Mix enabled
     */
    public getBassMix() {
        return this.state.system.bassMix;
    }

    /**
     * Set whether the AV2 should have Bass Mix enabled; true = on, false = off
     */
    public setBassMix(bassMix: boolean) {
        if (bassMix && !this.state.system.bassMix) {
            this.port.sendCommand(NaimAV2Commands.BASS_MIX_ON);
            this.state.system.bassMix = true;
            return;
        }
        if (!bassMix && this.state.system.bassMix) {
            this.port.sendCommand(NaimAV2Commands.BASS_MIX_OFF);
            this.state.system.bassMix = false;
            return;
        }
    }

    /**
     * Returns whether the AV2 has Cine EQ enabled
     */
    public getCineEq() {
        return this.state.system.cineEq;
    }

    /**
     * Set whether the AV2 should have Cine EQ enabled; true = on, false = off
     */
    public setCineEq(cineEq: boolean) {
        if (cineEq && !this.state.system.cineEq) {
            this.port.sendCommand(NaimAV2Commands.CINE_EQ_ON);
            this.state.system.cineEq = true;
            return;
        }
        if (!cineEq && this.state.system.cineEq) {
            this.port.sendCommand(NaimAV2Commands.CINE_EQ_OFF);
            this.state.system.cineEq = false;
            return;
        }
    }

    /**
     * Return the current input as a string.
     */
    public getInput(): NaimAV2CurrentInput {
        return this.state.system.currentInput;
    }

    /**
     * Set the current input
     */
    public setInput(input: NaimAV2CurrentInput) {
        if (input === 'VIP1' && this.state.system.currentInput !== 'VIP1') {
            this.port.sendCommand(NaimAV2Commands.INPUT_AN1);
        }
        if (input === 'VIP2' && this.state.system.currentInput !== 'VIP2') {
            this.port.sendCommand(NaimAV2Commands.INPUT_AN2);
        }
        if (input === 'AN3' && this.state.system.currentInput !== 'AN3') {
            this.port.sendCommand(NaimAV2Commands.INPUT_AN3);
        }
        if (input === 'AN4' && this.state.system.currentInput !== 'AN4') {
            this.port.sendCommand(NaimAV2Commands.INPUT_AN4);
        }
        if (input === 'AN5' && this.state.system.currentInput !== 'AN5') {
            this.port.sendCommand(NaimAV2Commands.INPUT_AN5);
        }
        if (input === 'AN6' && this.state.system.currentInput !== 'AN6') {
            this.port.sendCommand(NaimAV2Commands.INPUT_AN6);
        }
        if (input === 'OP1' && this.state.system.currentInput !== 'OP1') {
            this.port.sendCommand(NaimAV2Commands.INPUT_OP1);
        }
        if (input === 'OP2' && this.state.system.currentInput !== 'OP2') {
            this.port.sendCommand(NaimAV2Commands.INPUT_OP2);
        }
        if (input === 'CO1' && this.state.system.currentInput !== 'CO1') {
            this.port.sendCommand(NaimAV2Commands.INPUT_CO1);
        }
        if (input === 'CO2' && this.state.system.currentInput !== 'CO2') {
            this.port.sendCommand(NaimAV2Commands.INPUT_CO2);
        }
        // TODO: How to set Multi input mode with VIP1 + VIP2?
        this.state.system.currentInput = input;
    }

    // NOTE: there is no resetAllDefaults method, as this will turn off
    // the EXT setting that enables RS-232 communication!

    /**
     * Reset all input settings to the defaults
     */
    public resetInputDefaults() {
        this.port.sendCommand(NaimAV2Commands.RESET_INPUT_DEFAULTS);
        this.port.sendCommand(NaimAV2Commands.INPUT_MENU_QUERY);
    }

    /**
     * Reset all speaker settings to the defaults
     */
    public resetSpeakerDefaults() {
        this.port.sendCommand(NaimAV2Commands.RESET_SPEAKER_DEFAULTS);
        this.port.sendCommand(NaimAV2Commands.SPEAKER_MENU_QUERY);
    }

    /**
     * Returns whether the AV2 is in Verbose mode.
     * 
     * A Verbose mode is included to allow the user to enable/disable RS232
     * information being sent when parameters are changed from the front 
     * panel or input signal changes occur. By default this is set to on.
     */
    public getVerbose() {
        return this.state.system.verbose;
    }

    /**
     * Set whether the AV2 should have Verbose mode enabled; true = on, false = off
     */
    public setVerbose(verbose: boolean) {
        if (verbose && !this.state.system.verbose) {
            this.port.sendCommand(NaimAV2Commands.VERBOSE_ON);
            this.state.system.verbose = true;
            return;
        }
        if (!verbose && this.state.system.verbose) {
            this.port.sendCommand(NaimAV2Commands.VERBOSE_OFF);
            this.state.system.verbose = false;
            return;
        }
    }

    /**
     * Returns whether the AV2 is in the Input Menu. 
     */
    public getInputMenuMode() {
        return this.state.system.inputMenu;
    }

    /**
     * Set whether the AV2 should be in the Input Menu; true = on, false = off
     */
    public setInputMenuMode(inputMenu: boolean) {
        if (inputMenu && !this.state.system.inputMenu) {
            this.port.sendCommand(NaimAV2Commands.ENTER_INPUT_MENU);
            return;
        }
        if (!inputMenu && this.state.system.inputMenu) {
            this.port.sendCommand(NaimAV2Commands.EXIT_INPUT_MENU);
            return;
        }
    }

    /**
     * Returns whether the AV2 is in the Speaker Menu. 
     */
    public getSpeakerMenuMode() {
        return this.state.system.speakerMenu;
    }

    /**
     * Set whether the AV2 should be in the Speaker Menu; true = on, false = off
     */
    public setSpeakerMenuMode(speakerMenu: boolean) {
        if (speakerMenu && !this.state.system.speakerMenu) {
            this.port.sendCommand(NaimAV2Commands.ENTER_SPEAKER_MENU);
            return;
        }
        if (!speakerMenu && this.state.system.speakerMenu) {
            this.port.sendCommand(NaimAV2Commands.EXIT_SPEAKER_MENU);
            return;
        }
    }

    /**
     * Returns whether the AV2 measurents are in 'Feet' or 'Metres'.
     */
    public getUnits(): 'Feet' | 'Metres' {
        return this.state.speaker.units;
    }

    /**
     * Sets whether the AV2 should measure in 'Feet' or 'Metres'.
     */
    public setUnits(units: 'Feet' | 'Metres') {
        if (units === this.state.speaker.units) {
            return;
        }
        if (units === 'Feet') {
            this.port.sendCommand(NaimAV2Commands.SET_UNITS_FEET);
        }
        if (units === 'Metres') {
            this.port.sendCommand(NaimAV2Commands.SET_UNITS_METRES);
        }
    }

    // TODO: Add OSD Menu controls - left out as I don't have a Naim DVD5 to test with

    /**
     * Get the current volume of the AV2. Returns an int 0..99
     */
    public getVolume(): number {
        return this.state.system.volume;
    }

    /**
     * Set the AV2 volume level.  Accepts an int 0..99
     */
    public setVolume(volume: number) {
        if (this.state.system.volume == volume) {
            return;
        }
        if (this.volumeChangeTimeout) {
            clearTimeout(this.volumeChangeTimeout);
        }
        this.port.sendCommand(
            NaimAV2Commands.VOLUME + String.fromCharCode(volume)
        );
        this.state.system.volume = volume;
        this.volumeChangeTimeout = setTimeout(this.syncTelevisionVolume.bind(this), 1000);
    }

    protected syncTelevisionVolume() {
        log('Sync television volume');
        // Requesting TV volume doesn't work - so we set the TV volume to match the AV2 instead...
        // this.cec.sendCommand(
        //     0x50,
        //     OperationCode.GIVE_AUDIO_STATUS
        // );
        this.cec.sendCommand(
            0x50,
            OperationCode.REPORT_AUDIO_STATUS,
            this.state.system.volume | (this.state.system.mute ? 0x80 : 0)
        );
    }

    /**
     * Increment the volume - skips 10 as this is broken, the AV2 sets volume to 0
     */
    public incrementVolume() {
        const vol = this.getVolume();
        if (vol === 99) {
            return; // 99 is max volume
        }
        let newVol = vol + 1;
        if (newVol == 10) {
            newVol = 11;
        }
        this.setVolume(newVol);
    }

    /**
     * Increment the volume - skips 10 as this is broken, the AV2 sets volume to 0
     */
    public decrementVolume() {
        const vol = this.getVolume();
        if (vol === 0) {
            return; // 0 is min volume
        }
        let newVol = vol - 1;
        if (newVol == 10) {
            newVol = 9;
        }
        this.setVolume(newVol);
    }

    public getInputLabel(input: NaimAV2CurrentInput): string {
        switch (input) {
            case 'VIP1': return this.state.input.vip1InputLabel;
            case 'VIP2': return this.state.input.vip2InputLabel;
            case 'AN3': return this.state.input.an3InputLabel;
            case 'AN4': return this.state.input.an4InputLabel;
            case 'AN5': return this.state.input.an5InputLabel;
            case 'AN6': return this.state.input.an6InputLabel;
            case 'OP1': return this.state.input.op1InputLabel;
            case 'OP2': return this.state.input.vip1InputLabel;
            case 'CO1': return this.state.input.vip1InputLabel;
            case 'CO2': return this.state.input.vip1InputLabel;
        }
        return '---';
    }

    /**
     * Set the label for a given input.
     * 
     * Usage:
     *     av.setInputLabel('AN3', 'DVD');
     */
    public setInputLabel(input: NaimAV2CurrentInput, label: NaimAV2InputLabel) {
        const labelCode = this.getByteForInputLabel(label);
        if (!labelCode) {
            return; // No label code to set
        }
        switch (input) {
            case 'VIP1': this.port.sendCommand(String.fromCharCode(67) + String.fromCharCode(labelCode)); break;
            case 'VIP2': this.port.sendCommand(String.fromCharCode(68) + String.fromCharCode(labelCode)); break;
            case 'AN3': this.port.sendCommand(String.fromCharCode(69) + String.fromCharCode(labelCode)); break;
            case 'AN4': this.port.sendCommand(String.fromCharCode(70) + String.fromCharCode(labelCode)); break;
            case 'AN5': this.port.sendCommand(String.fromCharCode(71) + String.fromCharCode(labelCode)); break;
            case 'AN6': this.port.sendCommand(String.fromCharCode(72) + String.fromCharCode(labelCode)); break;
            case 'OP1': this.port.sendCommand(String.fromCharCode(73) + String.fromCharCode(labelCode)); break;
            case 'OP2': this.port.sendCommand(String.fromCharCode(74) + String.fromCharCode(labelCode)); break;
            case 'CO1': this.port.sendCommand(String.fromCharCode(75) + String.fromCharCode(labelCode)); break;
            case 'CO2': this.port.sendCommand(String.fromCharCode(76) + String.fromCharCode(labelCode)); break;
        }
    }

    /**
     * Process a returning response from the AV2, and change internal state where applicable
     */
    protected processAV2Response(command: string) {
        const prevState = JSON.parse(JSON.stringify(this.state));
        const commandCode = command.charAt(0);
        switch (commandCode) {
            case NaimAV2Responses.SYSTEM_STATUS:
                let currentInput: NaimAV2CurrentInput = 'Future';
                switch (command.charCodeAt(2) & 15) { // char 3, bits 1-4
                    case 1: currentInput = 'VIP1'; break;
                    case 2: currentInput = 'VIP2'; break;
                    case 3: currentInput = 'AN3'; break;
                    case 4: currentInput = 'AN4'; break;
                    case 5: currentInput = 'AN5'; break;
                    case 6: currentInput = 'AN6'; break;
                    case 7: currentInput = 'OP1'; break;
                    case 8: currentInput = 'OP2'; break;
                    case 9: currentInput = 'CO1'; break;
                    case 10: currentInput = 'CO2'; break;
                    case 11: currentInput = 'Multi'; break;
                }
                let currentDecodeMode: NaimAV2CurrentDecodeMode = 'Future';
                switch (command.charCodeAt(5)) {
                    case 0: currentDecodeMode = 'Direct'; break;
                    case 1: currentDecodeMode = 'Mono'; break;
                    case 2: currentDecodeMode = 'Stereo'; break;
                    case 3: currentDecodeMode = 'PLII Music'; break;
                    case 4: currentDecodeMode = 'PLII Movie'; break;
                    case 5: currentDecodeMode = 'Neo:6 Cinema'; break;
                    case 6: currentDecodeMode = 'Neo:6 Music'; break;
                    case 7: currentDecodeMode = 'Neo:6'; break;
                    case 8: currentDecodeMode = 'DTS'; break;
                    case 9: currentDecodeMode = 'DTS ES-Matrix'; break;
                    case 10: currentDecodeMode = 'DTS ES-Discrete'; break;
                    case 11: currentDecodeMode = 'Dolby Digital'; break;
                    case 12: currentDecodeMode = 'Dolby Digital EX'; break;
                    case 13: currentDecodeMode = 'No signal'; break;
                    case 14: currentDecodeMode = 'Multi'; break;
                    case 15: currentDecodeMode = '---'; break;
                    case 16: currentDecodeMode = '1/1'; break;
                    case 17: currentDecodeMode = '1/0'; break;
                    case 18: currentDecodeMode = '2/0'; break;
                    case 19: currentDecodeMode = '3/0'; break;
                    case 20: currentDecodeMode = '2/1'; break;
                    case 21: currentDecodeMode = '3/1'; break;
                    case 22: currentDecodeMode = '2/2'; break;
                    case 23: currentDecodeMode = '3/2'; break;
                    case 48: currentDecodeMode = '1/1.1'; break;
                    case 49: currentDecodeMode = '1/0.1'; break;
                    case 50: currentDecodeMode = '2/0.1'; break;
                    case 51: currentDecodeMode = '3/0.1'; break;
                    case 52: currentDecodeMode = '2/1.1'; break;
                    case 53: currentDecodeMode = '3/1.1'; break;
                    case 54: currentDecodeMode = '2/2.1'; break;
                    case 55: currentDecodeMode = '3/2.1'; break;
                }
                this.state.system = {
                    power: !!((command.charCodeAt(1) >> 7) & 1), // char 2, bit 8
                    inputMenu: !!((command.charCodeAt(1) >> 6) & 1), // char 2, bit 7
                    speakerMenu: !!((command.charCodeAt(1) >> 5) & 1),
                    display: !!((command.charCodeAt(1) >> 4) & 1),
                    dolbyDigital: !!((command.charCodeAt(1) >> 3) & 1),
                    dolbyPLII: !!((command.charCodeAt(1) >> 2) & 1),
                    dts: !!((command.charCodeAt(1) >> 1) & 1),
                    stereo: !!((command.charCodeAt(1) >> 0) & 1),
                    midnightMode: !!((command.charCodeAt(2) >> 7) & 1),
                    bassMix: !!((command.charCodeAt(2) >> 6) & 1),
                    cineEq: !!((command.charCodeAt(2) >> 5) & 1),
                    verbose: !!((command.charCodeAt(2) >> 4) & 1),
                    mute: !!((command.charCodeAt(3) >> 7) & 1), // char 4, bit 8
                    volume: command.charCodeAt(3) & 127, // char 4, bits 1-7
                    currentInput,
                    currentDecodeMode
                };
                this.started = this.started | NaimAV2StartupState.GOT_SYSTEM;
                this.emit('stateChange', this.state, prevState);
            break;
            case NaimAV2Responses.INPUT_MENU_STATUS:                
                this.state.input = {
                    vip1InputLabel: this.getInputLabelForByte(command.charCodeAt(1), 'AN1'),
                    vip2InputLabel: this.getInputLabelForByte(command.charCodeAt(2), 'AN2'),
                    an3InputLabel: this.getInputLabelForByte(command.charCodeAt(3), 'AN3'),
                    an4InputLabel: this.getInputLabelForByte(command.charCodeAt(4), 'AN4'),
                    an5InputLabel: this.getInputLabelForByte(command.charCodeAt(5), 'AN5'),
                    an6InputLabel: this.getInputLabelForByte(command.charCodeAt(6), 'AN6'),
                    co1InputLabel: this.getInputLabelForByte(command.charCodeAt(7), 'CO1'),
                    co2InputLabel: this.getInputLabelForByte(command.charCodeAt(8), 'CO2'),
                    op1InputLabel: this.getInputLabelForByte(command.charCodeAt(9), 'OP1'),
                    op2InputLabel: this.getInputLabelForByte(command.charCodeAt(10), 'OP2'),
                    panorama: !!command.charCodeAt(11),
                    panoramaWidth: command.charCodeAt(12), // 0-7
                    panoramaDepth: command.charCodeAt(13) // 0-6
                };
                this.started = this.started | NaimAV2StartupState.GOT_INPUT;
                this.emit('stateChange', this.state, prevState);
            break;
            case NaimAV2Responses.SPEAKER_MENU_STATUS:
                this.state.speaker = {
                    speakerSizeMain: this.getSpeakerSizeForByte(command.charCodeAt(1)),
                    speakerSizeCentre: this.getSpeakerSizeForByte(command.charCodeAt(2)),
                    speakerSizeSurround: this.getSpeakerSizeForByte(command.charCodeAt(3)),
                    speakerSizeRear: this.getSpeakerSizeForByte(command.charCodeAt(4)),
                    subwoofer: !!command.charCodeAt(5),
                    units: !!command.charCodeAt(6) ? 'Feet' : 'Metres',
                    speakerDistanceLeft: command.charCodeAt(7),
                    speakerDistanceCentre: command.charCodeAt(8),
                    speakerDistanceRight: command.charCodeAt(9),
                    speakerDistanceRightSurround: command.charCodeAt(10),
                    speakerDistanceRightRear: command.charCodeAt(11),
                    speakerDistanceLeftRear: command.charCodeAt(12),
                    speakerDistanceLeftSurround: command.charCodeAt(13),
                    speakerDistanceSubwoofer: command.charCodeAt(14),
                    speakerLevelLeft: command.charCodeAt(15) - 30, // 0 = -30dB, 60 = +30dB
                    speakerLevelCentre: command.charCodeAt(16) - 30,
                    speakerLevelRight: command.charCodeAt(17) - 30,
                    speakerLevelRightSurround: command.charCodeAt(18) - 30,
                    speakerLevelRightRear: command.charCodeAt(19) - 30,
                    speakerLevelLeftRear: command.charCodeAt(20) - 30,
                    speakerLevelLeftSurround: command.charCodeAt(21) - 30,
                    speakerLevelSubwoofer: command.charCodeAt(22) - 30
                };
                this.started = this.started | NaimAV2StartupState.GOT_SPEAKER;
                this.emit('stateChange', this.state, prevState);
            break;
            case NaimAV2Responses.SOFTWARE_VERSION:
                // TODO: Check, is this charAt or charCodeAt?
                this.state.software.softwareVersion = command.charCodeAt(1) + '.' + command.charCodeAt(2);
                this.started = this.started | NaimAV2StartupState.GOT_SOFTWARE;
                this.emit('stateChange', this.state, prevState);
            break;
            case NaimAV2Responses.FIRMWARE_VERSION:
                // TODO: Check, is this charAt or charCodeAt?
                this.state.firmware.firmwareVersion = command.charCodeAt(1) + '.' + command.charCodeAt(2) + '.' + command.charCodeAt(3);
                this.started = this.started | NaimAV2StartupState.GOT_FIRMWARE;
                this.emit('stateChange', this.state, prevState);
            break;
        }
    }

    /**
     * Converts a byte from the AV2 response into one of the preset input labels.
     * 
     * The standard label for the input in question is passed in to be selected if the code is 0
     */
    protected getInputLabelForByte(byte: number, standardLabel: NaimAV2InputLabel): NaimAV2InputLabel {
        switch (byte) {
            case 0: return standardLabel;
            case 1: return 'DVD';
            case 2: return 'LASER';
            case 3: return 'TV';
            case 4: return 'SAT';
            case 5: return 'CABLE';
            case 6: return 'HDR';
            case 7: return 'VCR';
            case 8: return 'GAME';
            case 9: return 'PC';
            case 10: return 'PREAMP';
            case 11: return 'CD';
            case 12: return 'CDR';
            case 13: return 'TUNER';
            case 14: return 'DAB';
            case 15: return 'MD';
            case 16: return 'DAT';
            case 17: return 'TAPE';
            case 18: return 'AUX';
            case 19: return 'DVDA';
            case 20: return 'SACD';
        }
        return '---';
    }

    /**
     * Converts a byte from the AV2 response into one of the preset input labels
     * 
     * Returns null if no matching label is found
     */
    protected getByteForInputLabel(label: NaimAV2InputLabel): number | null {
        switch (label) {
            case 'AN1':
            case 'AN2':
            case 'AN3':
            case 'AN4':
            case 'AN5':
            case 'AN6':
            case 'OP1':
            case 'OP2':
            case 'CO1':
            case 'CO2':
                return 0;
            case 'DVD': return 1;
            case 'LASER': return 2;
            case 'TV': return 3;
            case 'SAT': return 4;
            case 'CABLE': return 5;
            case 'HDR': return 6;
            case 'VCR': return 7;
            case 'GAME': return 8;
            case 'PC': return 9;
            case 'PREAMP': return 10;
            case 'CD': return 11;
            case 'CDR': return 12;
            case 'TUNER': return 13;
            case 'DAB': return 14;
            case 'MD': return 15;
            case 'DAT': return 16;
            case 'TAPE': return 17;
            case 'AUX': return 18;
            case 'DVDA': return 19;
            case 'SACD': return 20;
            case '---': return 23;
        }
        return null;
    }

    protected getSpeakerSizeForByte(byte: number): NaimAV2SpeakerSize {
        switch (byte) {
            case 1: return 'Small';
            case 2: return 'Large';
            case 3: return '2 Small';
            case 4: return '2 Large';
        }
        return 'Off';
    }

}
