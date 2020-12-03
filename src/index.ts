import { NaimAV2 } from "./naim-av2/naim-av2";
import SerialPort from "serialport";

// // For testing without a serial port
// import MockBinding from "@serialport/binding-mock";
// SerialPort.Binding = MockBinding;
// MockBinding.createPort('/dev/ttyUSB0', { echo: true, record: true })

const av2 = new NaimAV2({
    comPort: '/dev/ttyUSB0'
});
