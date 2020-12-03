import SerialPort from 'serialport';
import { EventEmitter } from 'events';

export interface NaimAV2PortOptions {
    comPort: string; // '/dev/ttyUSB0'
}

/**
 * Low-level interface to communicate with the Naim AV2 processor/DAC/preamp.
 * 
 * Commands can be sent as strings via NaimAV2Port.sendCommand(), and incoming messages are
 * emitted as event 'data'.
 * 
 * Usage:
 *     const port = new NaimAV2Port({comPort: '/dev/ttyUSB0'});
 *     port.on('data', (response) => {
 *         console.log('AV2 response received', response);
 *     });
 *     port.sendCommand(NaimAV2Commands.STANDBY);
 */

export class NaimAV2Port extends EventEmitter {

    // Strings to send as part of each command message
    public static MESSAGE_HEADER = String.fromCharCode(42);
    public static MESSAGE_DEVICE_ID = 'AV2';
    public static MESSAGE_SPACE = String.fromCharCode(32);
    public static MESSAGE_EOL = String.fromCharCode(255);

    public static RESPONSE_HEADER = String.fromCharCode(35);

    public static COMMAND_QUEUE_INTERVAL = 25; // milliseconds between queue checks

    protected serial: SerialPort;

    // FIFO queue of commands to send
    protected sendBuffer: string[] = [];

    // Interval to periodically check the 'send' command queue for commands to send
    protected sendInterval: NodeJS.Timeout | null = null;

    // Flag to mark whether we're currently sending a command
    protected sending = false;

    // Time the last command finished sending.
    // Allows us to 
    protected lastSendCommandEndTime: number = 0;

    constructor(
        options: NaimAV2PortOptions
    ) {
        super();
        this.serial = new SerialPort(
            options.comPort,
            {
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                autoOpen: false
            }
        );

        // Emit incoming data from the AV2
        const responseHeader = NaimAV2Port.RESPONSE_HEADER + NaimAV2Port.MESSAGE_DEVICE_ID + NaimAV2Port.MESSAGE_SPACE;
        this.serial.on('data', (chunk: Buffer) => {
            const response = chunk.toString();
            // Remove "#AV2 " from start
            if (response.substr(0, 5) !== responseHeader) {
                console.log('ERROR response', response);
                return;
            }
            this.emit('data', response.substr(5).trimEnd());
        });

        // Translate incoming data packets

        // When the port opens, detect whether we have a new command to send periodically
        this.serial.on('open', () => {
            this.sendInterval = setInterval(() => {
                this.processCommandQueue();
            }, NaimAV2Port.COMMAND_QUEUE_INTERVAL);
        });

        // Log errors
        this.serial.on('error', (err) => {
            console.log(err);
        });

        // Open the serial connection
        this.serial.open();

        // TODO: Handle the connection closing
    }

    /**
     * Low-level method to send a raw Naim AV2 command over the serial port.
     * 
     * Usage:
     *     const av2 = new NaimAV2Port({comPort: '/dev/ttyUSB0'});
     *     av2.sendCommand(String.fromCharCode(33)); // 33 = 'On'
     *     av2.sendCommand(NaimAV2Commands.STANDBY);
     *     av2.sendCommand(NaimAV2Commands.VOLUME + String.fromCharCode(50)); // Set volume to 50
     */
    public sendCommand(command: string) {
        this.sendBuffer.push(command);
    }

    /**
     * 'Tick' to send any queued commands
     */
    protected async processCommandQueue() {
        if (this.sending || this.sendBuffer.length === 0) {
            return;
        }
        this.sending = true;
        const command: string = this.sendBuffer.shift()!; // '!' here is a 'non-null assertion' - tells typescript
                                                             // that this value is definitely not undefined, since array.shift()
                                                             // returns type 'string | undefined'.
        const timeSinceLast = this.lastSendCommandEndTime - Date.now();
        setTimeout(() => {
            this.serial.write(NaimAV2Port.MESSAGE_HEADER);
            this.serial.drain(() => {
                setTimeout(() => {
                    this.serial.write(NaimAV2Port.MESSAGE_HEADER);
                    this.serial.write(NaimAV2Port.MESSAGE_DEVICE_ID);
                    this.serial.write(NaimAV2Port.MESSAGE_SPACE);
                    this.serial.write(command);
                    this.serial.write(NaimAV2Port.MESSAGE_EOL);
                    this.serial.drain(() => {
                        // Once command has completed sending, record what time
                        this.lastSendCommandEndTime = Date.now();
                        // Mark the queue as ready to send the next command
                        this.sending = false;
                    });
                }, timeSinceLast > 200 ? 25 : 0); // If it's been longer than 200ms, insert a 25ms
                                                  // delay between first and second header character
            });
        }, timeSinceLast < 105 ? (105 - timeSinceLast) : 0); // Make sure there's been at least 105ms between commands
    }

}