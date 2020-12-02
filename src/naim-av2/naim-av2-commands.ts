
export const NaimAV2Commands = {
    // Single byte commands
    ON: String.fromCharCode(33),
    STANDBY: String.fromCharCode(34),
    MUTE_ON: String.fromCharCode(36),
    MUTE_OFF: String.fromCharCode(37),
    DISPLAY_ON: String.fromCharCode(38),
    DISPLAY_OFF: String.fromCharCode(39),
    MIDNIGHT_ON: String.fromCharCode(40),
    MIDNIGHT_OFF: String.fromCharCode(41),
    BASS_MIX_ON: String.fromCharCode(42),
    BASS_MIX_OFF: String.fromCharCode(43),
    CINE_EQ_ON: String.fromCharCode(44),
    CINE_EQ_OFF: String.fromCharCode(45),
    RESET_ALL: String.fromCharCode(46), // NOTE: This will set EXT to RC5 which will disable receiving RS232 messages!
    INPUT_AN1: String.fromCharCode(47),
    INPUT_AN2: String.fromCharCode(48),
    INPUT_AN3: String.fromCharCode(49),
    INPUT_AN4: String.fromCharCode(50),
    INPUT_AN5: String.fromCharCode(51),
    INPUT_AN6: String.fromCharCode(52),
    INPUT_OP1: String.fromCharCode(53),
    INPUT_OP2: String.fromCharCode(54),
    INPUT_CO1: String.fromCharCode(55),
    INPUT_CO2: String.fromCharCode(56),
    MODE_1: String.fromCharCode(57),
    MODE_2: String.fromCharCode(58),
    MODE_3: String.fromCharCode(59),
    MODE_4: String.fromCharCode(60),
    MODE_5: String.fromCharCode(61),
    MODE_6: String.fromCharCode(62),
    MODE_7: String.fromCharCode(63), // not used
    MODE_8: String.fromCharCode(64), // not used
    MODE_9: String.fromCharCode(65), // not used
    MODE_10: String.fromCharCode(66),
    RESET_INPUT_DEFAULTS: String.fromCharCode(80), // EXT not reset to RC5
    RESET_SPEAKER_DEFAULTS: String.fromCharCode(102),
    VERBOSE_ON: String.fromCharCode(103), // A Verbose mode is included to allow the user to enable/disable
                                          // RS232 information being sent when parameters are changed from the
                                          // front panel or input signal changes occur. By default this is set to on.
    VERBOSE_OFF: String.fromCharCode(104),
    STATUS_QUERY: String.fromCharCode(105),
    INPUT_MENU_QUERY: String.fromCharCode(106),
    SPEAKER_MENU_QUERY: String.fromCharCode(107),
    SOFTWARE_VERSION_QUERY: String.fromCharCode(108),
    FIRMWARE_VERSION_QUERY: String.fromCharCode(109),
    ENTER_INPUT_MENU: String.fromCharCode(110),
    EXIT_INPUT_MENU: String.fromCharCode(111),
    ENTER_SPEAKER_MENU: String.fromCharCode(112),
    EXIT_SPEAKER_MENU: String.fromCharCode(113),
    SET_UNITS_FEET: String.fromCharCode(114),
    SET_UNITS_METRES: String.fromCharCode(115),
    ENTER_OSD_MENU: String.fromCharCode(141),
    EXIT_OSD_MENU: String.fromCharCode(142),
    EXTRA_STATUS_QUERY: String.fromCharCode(144),
    // Multi-byte commands
    VOLUME: String.fromCharCode(35),
    VIP1_LABEL: String.fromCharCode(67),
    VIP2_LABEL: String.fromCharCode(68),
    AN3_LABEL: String.fromCharCode(69),
    AN4_LABEL: String.fromCharCode(70),
    AN5_LABEL: String.fromCharCode(71),
    AN6_LABEL: String.fromCharCode(72),
    OP1_LABEL: String.fromCharCode(73),
    OP2_LABEL: String.fromCharCode(74),
    CO1_LABEL: String.fromCharCode(75),
    CO2_LABEL: String.fromCharCode(76),
    PANORAMA: String.fromCharCode(77), // Dolby Panorama on/off
    PANORAMA_WIDTH: String.fromCharCode(78), // Dolby Panorama width
    PANORAMA_DEPTH: String.fromCharCode(79), // Dolby Panorama depth
    NEO6C: String.fromCharCode(116), // NEO6 Centre gain
    LABEL_1_INPUT: String.fromCharCode(117), // Assigns user label 1 to an input
    LABEL_1_1: String.fromCharCode(118), // Assigns an ASCII character to label 1 position 1
    LABEL_1_2: String.fromCharCode(119), // 0 = ‘ ‘ , 1-26 = ‘A’-‘Z’, 27-36 = ‘0’-‘9’, 37 = ‘.1’, 38 = ‘-‘,
    LABEL_1_3: String.fromCharCode(120), // 39 = ‘/’, 40 = ‘|’.
    LABEL_1_4: String.fromCharCode(121),
    LABEL_1_5: String.fromCharCode(122),
    LABEL_1_6: String.fromCharCode(123),
    LABEL_1_7: String.fromCharCode(124),
    LABEL_2_INPUT: String.fromCharCode(125), // Assigns user label 2 to an input
    LABEL_2_1: String.fromCharCode(126), // Assigns an ASCII character to label 2 position 1
    LABEL_2_2: String.fromCharCode(127), // 0 = ‘ ‘ , 1-26 = ‘A’-‘Z’, 27-36 = ‘0’-‘9’, 37 = ‘.1’, 38 = ‘-‘,
    LABEL_2_3: String.fromCharCode(128), // 39 = ‘/’, 40 = ‘|’.
    LABEL_2_4: String.fromCharCode(129),
    LABEL_2_5: String.fromCharCode(130),
    LABEL_2_6: String.fromCharCode(131),
    LABEL_2_7: String.fromCharCode(132),
    LABEL_3_INPUT: String.fromCharCode(133), // Assigns user label 3 to an input
    LABEL_3_1: String.fromCharCode(134), // Assigns an ASCII character to label 3 position 1
    LABEL_3_2: String.fromCharCode(135), // 0 = ‘ ‘ , 1-26 = ‘A’-‘Z’, 27-36 = ‘0’-‘9’, 37 = ‘.1’, 38 = ‘-‘,
    LABEL_3_3: String.fromCharCode(136), // 39 = ‘/’, 40 = ‘|’.
    LABEL_3_4: String.fromCharCode(137),
    LABEL_3_5: String.fromCharCode(138),
    LABEL_3_6: String.fromCharCode(139),
    LABEL_3_7: String.fromCharCode(140),
    LIP_SYNC: String.fromCharCode(145), // Lip sync delay, 0-15 = 0-150ms
    TEST_SIGNAL: String.fromCharCode(143),
    SPEAKER_LEVEL_L: String.fromCharCode(94), // Speaker level trim where 00 = -30dB, 30 = 0 and 60 = +30dB
    SPEAKER_LEVEL_C: String.fromCharCode(95),
    SPEAKER_LEVEL_R: String.fromCharCode(96),
    SPEAKER_LEVEL_SUR_R: String.fromCharCode(97),
    SPEAKER_LEVEL_REAR_R: String.fromCharCode(98),
    SPEAKER_LEVEL_REAR_L: String.fromCharCode(99),
    SPEAKER_LEVEL_SUR_L: String.fromCharCode(100),
    SPEAKER_LEVEL_SUB: String.fromCharCode(101),
    ENTER_PIC_UPDATE: String.fromCharCode(147), // This command sets the AV2 ready to load new PIC
                                                // software. Note: The contents of the PIC are erased by
                                                // this function.
    // Speaker menu only       
    SPEAKER_SIZE_MAIN: String.fromCharCode(81), // Main speakers can never be turned off, and can only be set to small if Sub is set to Yes.
    SPEAKER_SIZE_C: String.fromCharCode(82),
    SPEAKER_SIZE_SUR: String.fromCharCode(83),
    SPEAKER_SIZE_EXTRA: String.fromCharCode(84), // Can only select if surround speakers set to small or large.
    SUBWOOFER: String.fromCharCode(85),
    SUBWOOFER_FREQ: String.fromCharCode(146), // Can only be set if Sub set to yes and 1 or more speaker set to small.
    SPEAKER_DIST_L: String.fromCharCode(86), // 0...40 ft or 0...120 m (120 = 12.0m)
    SPEAKER_DIST_C: String.fromCharCode(87),
    SPEAKER_DIST_R: String.fromCharCode(88),
    SPEAKER_DIST_SUR_R: String.fromCharCode(89),
    SPEAKER_DIST_REAR_R: String.fromCharCode(90),
    SPEAKER_DIST_REAR_L: String.fromCharCode(91),
    SPEAKER_DIST_SUR_L: String.fromCharCode(92),
    SPEAKER_DIST_SUB: String.fromCharCode(93)    
};

/**
 * Options available to select for input labels
 */
export const NaimAV2InputLabels = {
    NONE: 23, // Turns input off and shows '---'
    AN1: 0,
    DVD: 1,
    LASER: 2,
    TV: 3,
    SAT: 4,
    CABLE: 5,
    HDR: 6,
    VCR: 7,
    GAME: 8,
    PC: 9,
    PREAMP: 10,
    CD: 11,
    CDR: 12,
    TUNER: 13,
    DAB: 14,
    MD: 15,
    DAT: 16,
    TAPE: 17,
    AUX: 18,
    DVDA: 19,
    SACD: 20
};

/**
 * Inputs available to select for user labels
 */
export const NaimAV2UserLabelInputs = {
    NONE: 0, // Do not assign the user label to any inputs
    AN1: 1,
    AN2: 2,
    AN3: 3,
    AN4: 4,
    AN5: 5,
    AN6: 6,
    OP1: 7,
    OP2: 8,
    CO1: 9,
    CO2: 10
};

export const NaimAV2SpeakerSizes = {
    OFF: 0, // Main speakers cannot be turned off
    SMALL: 1,
    LARGE: 2
};

export const NaimAV2ExtraSpeakerSizes = {
    OFF: 0,
    SMALL_1: 1, // 1 small extra speaker
    LARGE_1: 2, // 1 large extra speaker
    SMALL_2: 3, // 2 small extra speakers
    LARGE_2: 4, // 2 large extra speakers
};

export const NaimAV2SubwooferFreqs = {
    HZ_40: 0,
    HZ_50: 1,
    HZ_60: 2,
    HZ_70: 3,
    HZ_80: 4,
    HZ_90: 5,
    HZ_100: 6,
    HZ_110: 7,
    HZ_120: 8,
    HZ_130: 9,
    HZ_140: 10
};

export const NaimAV2Responses = {
    SYSTEM_STATUS: String.fromCharCode(105),
    INPUT_MENU_STATUS: String.fromCharCode(106),
    SPEAKER_MENU_STATUS: String.fromCharCode(107),
    SOFTWARE_VERSION: String.fromCharCode(108),
    FIRMWARE_VERSION: String.fromCharCode(109),
    EXTRA_STATUS: String.fromCharCode(144)
};
