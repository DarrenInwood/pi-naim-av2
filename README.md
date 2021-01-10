# pi-naim-av2

Raspberry Pi integration with Naim AV2 preamp/DAC/processor.

*NOT WORKING YET*

Intention is to develop a daemon process that runs on a Raspberry Pi,
detecting a television's power/input selection/volume state on the HDMI-CEC
bus and syncing this with the Naim AV2 power/input selection/volume state.

Would also be nice to have it integrate with Moode or similar, running on
the same Pi, so the AV2 can be used as a high-quality network streamer.

Stretch goal, allow a Chromecast Audio plugged in to the AV2 to also be
detected and auto-power on/switch inputs/control volume.

## Development

### Set up a dev environment

This has too many environment specific libraries to compile on a non-pi machine, eg. node-gyp compiled
serial port and CEC port.

Typically I've been using:

* Raspberry Pi with Moode installed, on the local network
* Windows dev machine with VS Code and git installed
* Mount `\\moodeaudio.local\SDCARD` on the Windows machine as a mapped network drive
* Check out the repository using VS Code into the mapped network drive
* Open a terminal window in VS Code, then `ssh pi@moodeaudio.local`
* Change into the `/mnt/SDCARD/pi-naim-av2` directory, then `sudo chown -R pi .` to make it writable by the `pi` user
* Install node and npm by running `sudo apt-get install nodejs`
* Install `cec-client` by running `sudo apt-get install cec-utils`
* Install dependencies by running `npm install` in the root of this repository
* Start dev server (see below)

### Running a dev server

Start a dev server (in a terminal ssh'd onto the Raspberry Pi) by running in the root of this
repository:

    npm run start:dev

If you look at this script in `package.json`, it sets a `DEBUG` environment variable.  This indicates to
the `debug` package what to output debug info for.