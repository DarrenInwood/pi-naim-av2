

import { EventEmitter } from "events";
import { CECMonitor} from '@senzil/cec-monitor';
import { debug } from 'debug';

export interface HdmiCecAudioSystemDeviceOptions {
    cecPort: string; // eg '/dev/cec0'
    osdName: string; // eg 'Naim AV2'
}

const log = debug('pi-naim-av2:HdmiCecAudioSystemDevice');

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
        this.monitor = new CECMonitor(options.osdName, {
            audio: true,
            com_port: 'RPI',
            auto_restart: true,
            debug: log.enabled
        });
        // Emit incoming messages from the CEC stream

    }

}
