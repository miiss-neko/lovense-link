#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs');
const os = require('os');
const path = require('path');
const term = require('terminal-kit').terminal;
const lovenseRequests = require('./utils/lovense-requests.js');
const cli = require('./src/cli.js');
const web = require('./src/web.js');

const config_file = path.join(path.resolve(__dirname), './config.json');

if (fs.existsSync(config_file)) start();
else setToken();

async function setToken() {
    const {token} = await prompts({
        type: 'text',
        name: 'token',
        message: `What's you're lovense token?`,
        validate: async (value) => {
            const {data} = await lovenseRequests.getQrCode(value, `${os.hostname()}-${os.release()}`);

            if (data.code === 502) return `Please go to: https://www.lovense.com/user/developer/info - My Application > API LAN > Enable API LAN and set a random callback URL.`;

            return data.code === 0 ? true : `Looks like you're token is invalid.`;
        },
    });

    if (token) {
        fs.writeFileSync(config_file, JSON.stringify({token, uniqueID: `${os.hostname()}-${os.release()}`, first_time: true}), {encoding: 'utf8'});
        start();
    } else term.red('Aborted!\n');
}

async function start() {
    const {app_mode} = await prompts({
        type: 'select',
        name: 'app_mode',
        message: `Which toy needs a link?`,
        choices: [
            {
                title: 'CLI',
                description: 'Functionalities in Command Line.',
                value: 'cli',
            },
            {
                title: 'Web',
                description: `Functionalities in your browser.`,
                value: 'web',
            },
            {
                title: 'Cancel',
                value: false,
            },
        ],
    });

    switch (app_mode) {
        case 'cli':
            cli();
            break;
        case 'web':
            web();
            break;
        default:
            term.red('Program stopped, See you next time!\n');
    }
}
