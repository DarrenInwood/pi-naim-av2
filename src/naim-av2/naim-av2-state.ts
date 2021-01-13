
export type NaimAV2CurrentInput = 'VIP1' | 'VIP2' | 'AN3' | 'AN4' | 'AN5' | 'AN6' | 'OP1' | 'OP2' | 'CO1' | 'CO2' | 'Multi' | 'Future';

export type NaimAV2CurrentDecodeMode = 'Direct' |
    'Mono' |
    'Stereo' |
    'PLII Music' |
    'PLII Movie' |
    'Neo:6 Cinema' |
    'Neo:6 Music' |
    'Neo:6' |
    'DTS' |
    'DTS ES-Matrix' |
    'DTS ES-Discrete' |
    'Dolby Digital' |
    'Dolby Digital EX' |
    'No signal' |
    'Multi' |
    '---' |
    '1/1' |
    '1/0' |
    '2/0' |
    '3/0' |
    '2/1' |
    '3/1' |
    '2/2' |
    '3/2' |
    'Future' |
    '1/1.1' |
    '1/0.1' |
    '2/0.1' |
    '3/0.1' |
    '2/1.1' |
    '3/1.1' |
    '2/2.1' |
    '3/2.1';

/**
 * The system state of the Naim AV2
 */
export interface NaimAV2SystemState {
    power: boolean;
    inputMenu: boolean;
    speakerMenu: boolean;
    display: boolean;
    dolbyDigital: boolean;
    dolbyPLII: boolean;
    dts: boolean;
    stereo: boolean;
    midnightMode: boolean;
    bassMix: boolean;
    cineEq: boolean;
    verbose: boolean;
    mute: boolean;
    volume: number; // int 0..99
    currentInput: NaimAV2CurrentInput;
    currentDecodeMode: NaimAV2CurrentDecodeMode;
}

/**
 * Possible options for input labels
 */
export type NaimAV2InputLabel = 'AN1' | 'AN2' | 'AN3' |
    'AN4' | 'AN5' | 'AN6' | 'OP1' | 'OP2' | 'CO1' | 'CO2' |
    'DVD' | 'LASER' | 'TV' | 'SAT' | 'CABLE' | 'HDR' |
    'VCR' | 'GAME' | 'PC' | 'PREAMP' | 'CD' | 'CDR' |
    'TUNER' | 'DAB' | 'MD' | 'DAT' | 'TAPE' | 'AUX' |
    'DVDA' | 'SACD' | '---';

/**
 * The Input Menu state of the Naim AV2
 */
export interface NaimAV2InputMenuState {
    vip1InputLabel: NaimAV2InputLabel;
    vip2InputLabel: NaimAV2InputLabel;
    an3InputLabel: NaimAV2InputLabel;
    an4InputLabel: NaimAV2InputLabel;
    an5InputLabel: NaimAV2InputLabel;
    an6InputLabel: NaimAV2InputLabel;
    co1InputLabel: NaimAV2InputLabel;
    co2InputLabel: NaimAV2InputLabel;
    op1InputLabel: NaimAV2InputLabel;
    op2InputLabel: NaimAV2InputLabel;
    panorama: boolean;
    panoramaWidth: number; // 0-7
    panoramaDepth: number; // 0-6
}

export type NaimAV2SpeakerSize = 'Off' | 'Small' | 'Large' | '2 Small' | '2 Large';

/**
 * The Speaker Menu state of the Naim AV2
 */
export interface NaimAV2SpeakerMenuState {
    speakerSizeMain: NaimAV2SpeakerSize;
    speakerSizeCentre: NaimAV2SpeakerSize;
    speakerSizeSurround: NaimAV2SpeakerSize;
    speakerSizeRear: NaimAV2SpeakerSize;
    subwoofer: boolean;
    units: 'Feet' | 'Metres';
    speakerDistanceLeft: number;
    speakerDistanceCentre: number;
    speakerDistanceRight: number;
    speakerDistanceRightSurround: number;
    speakerDistanceRightRear: number;
    speakerDistanceLeftRear: number;
    speakerDistanceLeftSurround: number;
    speakerDistanceSubwoofer: number;
    speakerLevelLeft: number;
    speakerLevelCentre: number;
    speakerLevelRight: number;
    speakerLevelRightSurround: number;
    speakerLevelRightRear: number;
    speakerLevelLeftRear: number;
    speakerLevelLeftSurround: number;
    speakerLevelSubwoofer: number;
}

/**
 * The system state of the Naim AV2
 */
export interface NaimAV2SoftwareVersionState {
    softwareVersion: string;
}

/**
 * The system state of the Naim AV2
 */
export interface NaimAV2FirmwareVersionState {
    firmwareVersion: string;
}

/**
 * The "Extra Status" state of the Naim AV2
 */
export interface NaimAV2ExtraState {
    
}

/**
 * The complete internal state of the Naim AV2
 */
export interface NaimAV2State {
    system: NaimAV2SystemState;
    input: NaimAV2InputMenuState;
    speaker: NaimAV2SpeakerMenuState;
    software: NaimAV2SoftwareVersionState;
    firmware: NaimAV2FirmwareVersionState;
    extra: NaimAV2ExtraState;
};
