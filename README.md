# pi-naim-av2

Raspberry Pi integration with Naim AV2 preamp/DAC/processor.

A daemon process that runs on a Raspberry Pi,
detecting a television's power/input selection/volume state on the HDMI-CEC
bus and syncing this with the Naim AV2 power/input selection/volume state.

Also detects audio output from a streamer eg. Moode running on the same Pi.

Stretch goal, allow a Chromecast Audio plugged in to the AV2 to also be
detected and auto-power on/switch inputs/control volume.

## Hardware

Aside from the obvious audio connections between your Pi, TV, and AV2, you will need a USB-RS232 dongle cable connected between the Pi and the AV2's serial port.

You will also need to change the 'DATA' setting on the AV2 to 'EXT' - the default is 'RC5'.  This tells the AV2 to listen to incoming messages on the RS-232 port.

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

## Building

Run `npm run build` in the root of this repository.  This will compile Typescript to Javascript in the `build` folder.

## Installing as a service

An easy way to install as a service is via (PM2)[https://github.com/Unitech/pm2].

1. Install PM2 globally on your Pi - `sudo npm install -g pm2`
2. Tell PM2 to run on boot - `pm2 startup` then copy/paste the generated output
3. Build the application - see above.
4. Start the application you've just built using PM2 - `cd build && pm2 start index.js --name 'pi-naim-av2'`
5. Tell PM2 to restart this process again on boot - `pm2 save`

If you make some code changes, you will need to build the application again and then restart it via PM2:

    pm2 stop pi-naim-av2
    npm run start:dev
    <make code changes>
    npm run build
    pm2 start pi-naim-av2

