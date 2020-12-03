

import { EventEmitter } from "events";
import {CEC, CECMonitor} from '@senzil/cec-monitor';

export interface HdmiCecAudioSystemDeviceOptions {
    cecPort: string; // eg '/dev/cec0'
    osdName: string; // eg 'Naim AV2'
}

// HDMI-CEC spec:
// https://github.com/floe/CEC/blob/master/extras/CEC_Specs.pdf

/**
 * Provides the behaviour of an HDMI-CEC "Audio System" type device.
 */

export class HdmiCecAudioSystemDevice extends EventEmitter {

    protected monitor: any;

    constructor(
        options: HdmiCecAudioSystemDeviceOptions
    ) {
        super();
        this.monitor = new CECMonitor(options.osdName, {audio: true});
        // Emit incoming messages from the CEC stream

    }


}
