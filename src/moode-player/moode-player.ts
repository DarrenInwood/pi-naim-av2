import { debug } from "debug";
import { EventEmitter } from "events";
import * as fs from 'fs';
import * as ini from 'ini';

const log = debug('pi-naim-av2:moode-player');

export interface MoodePlayerOptions {
    mediaInfoFile: string;
}

/**
 * Data about the currently playing media
 */
export interface MediaInfo {
    file?: string;
    artist?: string;
    album?: string;
    title?: string;
    coverurl?: string;
    track?: number;
    date?: string;
    composer?: string;
    encoded?: string;
    bitrate?: string;
    outrate?: string;
    volume?: string;
    mute?: string;
    state?: string;
}

/**
 * Interface to interact with a Moode server running on the local machine.
 * 
 * Emits events:
 * 
 * 'play', 
 * 'stop',
 * 'mediaChange', MediaInfo
 */

export class MoodePlayer extends EventEmitter {

    protected config: MoodePlayerOptions;

    /**
     * Whether or not the Raspberry Pi is currently outputting audio
     */
    protected playing: boolean = false;

    /**
     * The current media info
     */
    protected mediaInfo: MediaInfo | null = null;

    protected audioOutputPollInterval: NodeJS.Timeout | null = null;
    protected mediaInfoPollInterval: NodeJS.Timeout | null = null;

    constructor(config: MoodePlayerOptions | null = null) {
        super();

        // Set default options
        if (config === null) {
            config = {
                mediaInfoFile: '/var/local/www/currentsong.txt'
            };
        }

        this.config = config;

        // Poll the audio output for activity
        this.audioOutputPollInterval = setInterval(this.pollAudioOutputs.bind(this), 437);

        // Poll the media info file for song details
        this.mediaInfoPollInterval = setInterval(this.pollMediaInfoFile.bind(this), 601);
    }

    protected pollAudioOutputs() {
        const cardDir = '/proc/asound';
        // Find all cards and see if any are playing
        fs.readdir(cardDir, (err, files) => {
            if (err) {
                log('Error reading /proc/asound - %j', err);
                return;
            }
            let nowPlaying = false;
            files.forEach((file) => {
                if (file.substring(0, 4) !== 'card' || isNaN(parseInt(file[4], 10))) {
                    return;
                }
                const buf = fs.readFileSync(cardDir + '/' + file + '/pcm0p/sub0/hw_params');
                if (buf.toString().substring(0, 6) !== 'closed') {
                    nowPlaying = true;
                }
            });
            if (nowPlaying !== this.playing) {
                this.playing = nowPlaying;
                this.emit(nowPlaying ? 'play' : 'stop');
                log('Emitted %s', nowPlaying ? 'play' : 'stop')
            }
        });
    }

    protected pollMediaInfoFile() {
        // Get the contents of the media info file
        const buf = fs.readFileSync(this.config.mediaInfoFile);
        const mediaInfo = ini.parse(buf.toString()) as MediaInfo;
        // If it's different from the current state, emit it
        if (this.playing && JSON.stringify(mediaInfo) !== JSON.stringify(this.mediaInfo)) {
            this.mediaInfo = mediaInfo;
            this.emit('mediaChange', mediaInfo);
            log('mediaChange - %j', mediaInfo);
        }
    }
}
