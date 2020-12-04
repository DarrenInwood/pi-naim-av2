import { NaimAV2 } from "./naim-av2/naim-av2";
import { debug } from 'debug';
import SerialPort from "serialport";
import MockBinding from "@serialport/binding-mock";

const log = debug('pi-naim-av2:main');

// // For testing without a serial port
if (log.enabled) {
    SerialPort.Binding = MockBinding;
    MockBinding.createPort('/dev/ttyUSB0', { echo: true, record: true })
}

const av2 = new NaimAV2({
    comPort: '/dev/ttyUSB0'
});
