import SerialPort from 'serialport';
import { EventEmitter } from 'events';
import { debug }  from 'debug';

const log = debug('pi-naim-av2:naim-av2-port');

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
                // Settings for Naim AV2 from spec
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                rtscts: false,
                xany: false,
                xoff: false,
                xon: false
            }
        );

        // Ignore break characters
        this.serial.set({brk: false});

        // Parse out EOL characters
        const parser = this.serial.pipe(
            new SerialPort.parsers.Delimiter(
                {
                    delimiter: Buffer.from(NaimAV2Port.MESSAGE_EOL, 'ascii')
                }
            )
        );

        // Emit incoming data from the AV2
        const responseHeader = NaimAV2Port.RESPONSE_HEADER + NaimAV2Port.MESSAGE_DEVICE_ID + NaimAV2Port.MESSAGE_SPACE;
        parser.on('data', (chunk: Buffer) => {
            const response = chunk.toString();
            log('<<< Raw data from AV2: %s', response);
            // Remove "#AV2 " from start
            if (response.substr(0, 5) !== responseHeader) {
                log('ERROR');
                return;
            }
            this.emit('command', response.substr(5).trimEnd());
        });

        // Translate incoming data packets

        // When the port opens, detect whether we have a new command to send periodically
        this.serial.on('open', () => {
            log('Serial port opened: %o', options);
            this.sendInterval = setInterval(() => {
                this.processCommandQueue();
            }, NaimAV2Port.COMMAND_QUEUE_INTERVAL);
            this.emit('ready');
        });

        // Log errors
        this.serial.on('error', (err) => {
            log('Serial port error: %O', err);
        });
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
        log('Queued command: %s', command);
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
        const timeSinceLast = Date.now() - this.lastSendCommandEndTime;
        const messageDelay = timeSinceLast < 105;
        const headerDelay = timeSinceLast > 200;
        log('Sending command: %O', {command, timeSinceLast, messageDelay, headerDelay});
        // NOTE: Must write to the serial port using Buffer rather than string, to avoid
        // automatically sending EOL characters for each write()
        setTimeout(() => {
            this.serial.write(Buffer.from(NaimAV2Port.MESSAGE_HEADER, 'ascii'));
            this.serial.drain(() => {
                setTimeout(() => {
                    this.serial.write(
                        Buffer.from(
                            NaimAV2Port.MESSAGE_HEADER +
                            NaimAV2Port.MESSAGE_DEVICE_ID +
                            NaimAV2Port.MESSAGE_SPACE +
                            command +
                            NaimAV2Port.MESSAGE_EOL,
                            'ascii'
                        )
                    );
                    this.serial.drain(() => {
                        // Once command has completed sending, record what time
                        this.lastSendCommandEndTime = Date.now();
                        // Mark the queue as ready to send the next command
                        this.sending = false;
                        log('Sent command: %s', command);
                    });
                }, headerDelay ? 25 : 0); // If it's been longer than 200ms, insert a 25ms
                                                  // delay between first and second header character
            });
        }, messageDelay ? (105 - timeSinceLast) : 0); // Make sure there's been at least 105ms between commands
    }

}