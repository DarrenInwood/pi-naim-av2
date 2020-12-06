

import { EventEmitter } from "events";
import { CEC, CECMonitor} from '@senzil/cec-monitor';
import { debug } from 'debug';

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
 * Mandatory messages the device must send/receive:
 * Poll - send/receive (A device may poll logical addresses no more than once every 30 seconds)
 * 0x00 Feature abort - send/receive
 * 0x04 Image view on - send (advertises to the TV that this source has something to display)
 * 0x0D Text view on - send
 * 0x36 Standby - receive (can send)
 * 0x44 User control pressed - receive
 * 0x45 User control released - receive
 * 0x46 Give OSD name - receive
 * 0x70 System audio mode request - receive
 * 0x71 Give audio status - receive
 * 0x72 Set System audio mode - receive
 * 0x7A Report audio status - send
 * 0x7D Give system audio mode status - receive
 * 0x7E System audio mode status - send
 * 0x82 Active source - send/receive
 * 0x83 Give physical address - receive
 * 0x84 Report physical address - send
 * 0x85 Request active source - receive
 * 0x87 Device vendor ID - receive
 * 0x8C Give device vendor ID - send
 * 0x8F Give device power status - receive
 * 0x90 Report power status - send
 * 0x9D Inactive source - send
 * 0x9E Report CEC version - send (05:9E:03 = CEC 1.4)
 * 0x9F Get CEC version - receive
 * 0xA3 Report short audio descriptor - send
 * 0xA4 Request short audio descriptor - receive
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
 * 0x66 Unmute (optional)
 * 0x69 Select AV Input function (optional)
 * 0x6A Select Audio input (optional)
 * 0x6B Power toggle (optional)
 * 0x6C Power off (optional)
 * 0x6D Power on (optional)
 * 2
 */

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
        physicalAddress: [0,0,0,0],
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

        // TODO: Send polling messages every 45sec
        // this.pollingInterval = setInterval(() = {
        //     this.monitor.WriteMessage(
        //         CEC.LogicalAddress.AUDIOSYSTEM,
        //         CEC.LogicalAddress.BROADCAST,
        //         CEC.Opcode.???
        //     );
        // }, 45000);
    }

    /**
     * Listen for the various messages we should respond to
     */
    protected setupListeners() {
        this.monitor.on(CECMonitor.EVENTS.GET_CEC_VERSION, (event: any) => {
            log('<<< GET_CEC_VERSION - sending VERSION_1_4');
            this.monitor.SendMessage(
                CEC.LogicalAddress.AUDIOSYSTEM,
                event.source,
                CEC.Opcode.CEC_VERSION,
                CEC.CECVersion.VERSION_1_4
            );
        });

        // TODO: how to respond to polling messages?
        this.monitor.on(CECMonitor.EVENTS.POLLING_MESSAGE, (event: any) => {
            log('<<< POLLING_MESSAGE - sending ???');
            // this.monitor.SendMessage(

            // );
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

        this.monitor.on(CECMonitor.EVENTS.GIVE_OSD_NAME, (event: any) => {
            log('<<< GIVE_OSD_NAME - sending %s', this.options.osdName);
            this.monitor.SendMessage(
                CEC.LogicalAddress.AUDIOSYSTEM,
                event.source,
                CEC.Opcode.SET_OSD_NAME,
                this.options.osdName
            );
        });

        
    }

}
