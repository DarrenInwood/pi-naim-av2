

import { debug } from 'debug';
import { EventEmitter } from 'events';

import { CEC, CECMonitor } from '@senzil/cec-monitor';

/**
 * Constructor options
 */
export interface HdmiCecAudioSystemDeviceOptions {
    cecPort: string; // eg '/dev/cec0'
    osdName: string; // eg 'Naim AV2'
}

/**
 * Internal state
 */
export interface HdmiCecAudioSystemState {
    power: boolean;
    mute: boolean;
    volume: number;
    physicalAddress: number[];
    activeSource: boolean;
};

const log = debug('pi-naim-av2:HdmiCecAudioSystemDevice');

// HDMI-CEC spec:
// https://github.com/floe/CEC/blob/master/extras/CEC_Specs.pdf

/**
 * Provides the behaviour of an HDMI-CEC "Audio System" type device.
 * 
 * Mandatory messages the device must send/receive: (X = mandatory, O = optional)
 * 
 * Hex  Name                            Implemented  Send Receive Comments
 * Poll                                 (recv)       X    X       No more than once every 30 seconds
 * 0x00 Feature abort                                X    X       Default response to directly addressed messages we don't respond to
 * 0x04 Image view on                   -            X            Advertises to the TV that this source has something to display
 * 0x0D Text view on                    -            X
 * 0x36 Standby                         X            O    X       If all sources are in standby mode, AV2 should power off
 * 0x44 User control pressed                              X       See table below for mandatory/optional keys to respond to
 * 0x45 User control released                             X       See table below for mandatory/optional keys to respond to
 * 0x46 Give OSD name                   X                 X       Responds: 0x47 Report OSD name
 * 0x47 Report OSD name                 X            O            
 * 0x70 System audio mode request       X                 X
 * 0x71 Give audio status               X                 X       Responds: 0x7A Report audio status
 * 0x72 Set System audio mode           X                 X       Can be addressed of broadcast. Indicates to AV2 whether the TV wants it to be on or off
 * 0x7A Report audio status             X            X
 * 0x7D Give system audio mode status                     X       Responds: 0x7E System audio mode status
 * 0x7E System audio mode status                     X
 * 0x82 Active source                                X    X       Received from TV, should set AV2 input selector
 * 0x83 Give physical address                             X       Responds: 0x84 Report physical address
 * 0x84 Report physical address                      X
 * 0x85 Request active source                             X
 * 0x87 Device vendor ID                X            X
 * 0x8C Give device vendor ID           X                 X       Responds: 0x87 Device vendor ID
 * 0x8F Give device power status        X                 X       Responds: 0x90 Report power status
 * 0x90 Report power status             X            X
 * 0x9D Inactive source                              X
 * 0x9E Report CEC version              X            X            (05:9E:03 = CEC 1.4)
 * 0x9F Get CEC version                 X                 X       Responds: 0x9E Report CEC version
 * 0xA3 Report short audio descriptor                X
 * 0xA4 Request short audio descriptor                    X
 * 
 * Mandatory remote control keypresses the device should forward to the TV:
 * 0x00 Select
 * 0x01 Up
 * 0x02 Down
 * 0x03 Left
 * 0x04 Right
 * 0x41 Volume up
 * 0x42 Volume down
 * 0x65 Mute
 * 
 * Optional keypresses the device should forward to the TV:
 * 0x66 Unmute
 * 0x69 Select AV Input function
 * 0x6A Select Audio input
 * 0x6B Power toggle
 * 0x6C Power off
 * 0x6D Power on
 */

interface CecPacket {
    type: string,
    number: string,
    flow: 'IN' | 'OUT',
    source: number, // int
    target: number, // int
    opcode: number, // int
    args: number[], // int
    data?: {
        val: string,
        str: string
    }
}

export class HdmiCecAudioSystemDevice extends EventEmitter {

    /**
     * The low-level CEC comms interface
     */
    protected monitor: any; // TODO: CECMonitor - does it need type def?

    /**
     * The interval that handles sending Polling CEC messages
     */
    protected pollingInterval: Timeout = null;

    /**
     * Internal state
     */
    protected state: HdmiCecAudioSystemState = {
        power: false,
        mute: false,
        volume: 0,
        physicalAddress: [0x00, 0x00, 0x05],
        activeSource: false
    };

    constructor(
        protected options: HdmiCecAudioSystemDeviceOptions
    ) {
        super();
        this.monitor = new CECMonitor(options.osdName, {
            audio: true,
            com_port: 'RPI',
            auto_restart: true,
            debug: log.enabled
        });
        
        // Once the adapter is ready, initialise the device on the CEC bus
        this.monitor.once(CECMonitor.EVENTS._READY, function() {
            log('CEC device ready');
            this.setup(); 
        });
    }

    /**
     * Set up the device on the CEC bus.
     */
    protected setup() {
        // Start monitoring incoming messages
        this.setupListeners();

        // Is the TV on?
        this.monitor.WriteMessage(
            CEC.LogicalAddress.AUDIOSYSTEM,
            CEC.LogicalAddress.TV,
            CEC.Opcode.GIVE_DEVICE_POWER_STATUS
        );
        // Broadcast OSD name
        this.monitor.SendMessage(
            CEC.LogicalAddress.AUDIOSYSTEM,
            CEC.LogicalAddress.BROADCAST,
            CEC.Opcode.SET_OSD_NAME,
            this.options.osdName
        ); 

        // TODO: Send polling messages every 45sec?
        // this.pollingInterval = setInterval(() => {
        //     this.monitor.WriteMessage(
        //         CEC.LogicalAddress.AUDIOSYSTEM,
        //         CEC.LogicalAddress.BROADCAST,
        //         CEC.Opcode.
        //     );
        // }, 45000);
    }

    /**
     * Listen for the various messages we should respond to
     */
    protected setupListeners() {
        this.monitor.on(CECMonitor.EVENTS.GET_CEC_VERSION, (event: CecPacket) => {
            log('<<< GET_CEC_VERSION - sending VERSION_1_4');
            this.monitor.SendMessage(
                CEC.LogicalAddress.AUDIOSYSTEM,
                event.source,
                CEC.Opcode.CEC_VERSION,
                CEC.CECVersion.VERSION_1_4
            );
        });

        // TODO: how to respond to polling messages?
        this.monitor.on(CECMonitor.EVENTS.POLLING_MESSAGE, (event: CecPacket) => {
            log('<<< POLLING_MESSAGE');
        });

        this.monitor.on(CECMonitor.EVENTS.STANDBY, () => {
            if (!this.state.power) {
                log('<<< STANDBY - already in standby mode');
                return;
            }
            log('<<< STANDBY - powering off');
            const prevState = {...this.state};
            this.state.power = false;
            this.emit('stateChange', this.state, prevState);            
        });

        this.monitor.on(CECMonitor.EVENTS.GIVE_DEVICE_VENDOR_ID, (event: CecPacket) => {
            log('<<< GIVE_DEVICE_VENDOR_ID - sending DEVICE_VENDOR_ID UNKNOWN');
            this.monitor.SendMessage(
                CEC.LogicalAddress.AUDIOSYSTEM,
                CEC.LogicalAddress.BROADCAST,
                CEC.Opcode.DEVICE_VENDOR_ID,
                CEC.VendorId.UNKNOWN
            );
        });
        
        this.monitor.on(CECMonitor.EVENTS.GIVE_DEVICE_POWER_STATUS, (event: CecPacket) => {
            log('<<< GIVE_DEVICE_POWER_STATUS - sending REPORT_POWER_STATUS %s', (this.state.power ? 'ON' : 'STANDBY'));
            this.monitor.SendMessage(
                CEC.LogicalAddress.AUDIOSYSTEM,
                event.source,
                CEC.Opcode.REPORT_POWER_STATUS,
                (this.state.power ? CECMonitor.PowerStatus.ON : CECMonitor.PowerStatus.STANDBY)
            );
        });

        this.monitor.on(CECMonitor.EVENTS.GIVE_OSD_NAME, (event: CecPacket) => {
            log('<<< GIVE_OSD_NAME - sending SET_OSD_NAME %s', this.options.osdName);
            this.monitor.SendMessage(
                CEC.LogicalAddress.AUDIOSYSTEM,
                event.source,
                CEC.Opcode.SET_OSD_NAME,
                this.options.osdName
            );
        });

        this.monitor.on(CECMonitor.EVENTS.GIVE_PHYSICAL_ADDRESS, (event: CecPacket) => {
            log('<<< GIVE_PHYSICAL_ADDRESS - sending REPORT_PHYSICAL_ADDRESS %s', this.state.physicalAddress.toString());
            this.monitor.SendMessage(
                CEC.LogicalAddress.AUDIOSYSTEM,
                CEC.LogicalAddress.BROADCAST,
                CEC.Opcode.REPORT_PHYSICAL_ADDRESS,
                this.state.physicalAddress // TODO: is this correct? 
            );
        });

        this.monitor.on(CECMonitor.EVENTS.SYSTEM_AUDIO_MODE_REQUEST, (event: CecPacket) => {
            log('<<< SYSTEM_AUDIO_MODE_REQUEST - sending SET_SYSTEM_AUDIO_MODE %s', (this.state.power ? 'ON' : 'OFF'));
            this.monitor.SendMessage(
                CEC.LogicalAddress.AUDIOSYSTEM,
                CEC.LogicalAddress.BROADCAST,
                CEC.Opcode.SET_SYSTEM_AUDIO_MODE,
                this.state.power ? CEC.SystemAudioStatus.ON : CEC.SystemAudioStatus.OFF
            );
        });

        this.monitor.on(CECMonitor.EVENTS.GIVE_AUDIO_STATUS, (event: CecPacket) => {
            log(
                '<<< GIVE_AUDIO_STATUS - sending REPORT_AUDIO_STATUS %s/%s',
                this.state.volume,
                (this.state.power ? 'ON' : 'OFF')
            );
            this.monitor.SendMessage(
                CEC.LogicalAddress.AUDIOSYSTEM,
                CEC.LogicalAddress.BROADCAST,
                CEC.Opcode.REPORT_AUDIO_STATUS,
                this.state.volume | (this.state.power ? 0x80 : 0x00)
            );
        });


    }

}
