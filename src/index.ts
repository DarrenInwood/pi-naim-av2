import { NaimAV2 } from "./naim-av2/naim-av2";

const av2 = new NaimAV2({
    comPort: '/dev/tty.Bluetooth-Incoming-Port'
});

console.log(av2.getState());
