

import { EventEmitter } from "events";
import { Device, Msg } from 'node-linux-cec';

export interface TvHdmiCecPortOptions {
    cecPort: string; // eg '/dev/cec0'
}

/**
 * Low-level communications class for sending/receiving HDMI-CEC messages
 * with a connected device
 */

export class TvHdmiCecPort extends EventEmitter {

    protected device: Device;

    constructor(
        options: TvHdmiCecPortOptions
    ) {
        super();
        this.device = new Device(options.cecPort);

        // Emit incoming messages from the CEC stream
        this.device.on('message', async (msg: Msg) => {
            this.handleMessage(msg);
        });
    }

    protected handleMessage(msg: Msg) {
        if 
    }
}
