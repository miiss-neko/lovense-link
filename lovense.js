#!/usr/bin/env node

const prompts = require('prompts');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const term = require('terminal-kit').terminal;
const opn = require('better-opn');

const config_file = path.join(path.resolve(__dirname), 'config.json');
let config = { token: undefined, uniqueID: `${os.hostname()}-${os.release()}` };

if (fs.existsSync(config_file)) {
    config = JSON.parse(fs.readFileSync(config_file, { encoding: 'utf8' }));
    start();
} else setToken();

async function setToken() {
    const { token } = await prompts({
        type: 'text',
        name: 'token',
        message: `What's you're lovense token?`,
        validate: async (value) => {
            const { data } = await axios.post('https://api.lovense.com/api/lan/getQrCode', {}, {
                params: {
                    token: value,
                    uid: config.uniqueID,
                    uname: os.hostname(),
                    utoken: config.uniqueID,
                }
            });

            if (data.code === 502) return `Please go to: https://www.lovense.com/user/developer/info - My Application > API LAN > Enable API LAN and set a random callback URL.`;

            return data.code === 0 ? true : `Looks like you're token is invalid.`;
        }
    });

    if (token) {
        config.token = token;

        fs.writeFileSync(config_file, JSON.stringify(config), { encoding: 'utf8' });

        scanQrCode();
    } else term.red('Aborted!\n');
}

async function start() {
    const { action } = await prompts({
        type: 'select',
        name: 'action',
        message: `What do you want to do?`,
        choices: [
            {
                title: 'Scan QR Code',
                description: `Open QR Code to scan in you're default browser.`,
                value: 'qrcode',
            },
            {
                title: 'Get Control Link',
                description: `Display the list of you're toys and get a control link.`,
                value: 'link',
            }
        ],
    });

    switch (action) {
        case 'qrcode':
            scanQrCode();
            break;
        case 'link':
            getControlLink();
            break;
        default:
            term.red('Aborted!\n');
    }
}

async function scanQrCode() {
    const { action } = await prompts({
        type: 'select',
        name: 'action',
        message: `You now have to scan a QR Code, please choose how to open the link.`,
        choices: [
            {
                title: 'Browser',
                description: `Will open the link with you're. default browser`,
                value: 'browser',
            },
            {
                title: 'Terminal',
                description: 'Will display the link in terminal.',
                value: 'terminal',
            }
        ]
    });

    if (action)
        axios.post('https://api.lovense.com/api/lan/getQrCode', {}, {
            params: {
                token: config.token,
                uid: config.uniqueID,
                uname: os.hostname(),
                utoken: config.uniqueID,
            }
        }).then(({ data }) => {
            if (data.code === 0) {
                if (action === 'browser') opn(data.message);
                else term('QR Code link: ').yellow(data.message).black('\n');

                askCodeScanned();
            }
        });
    else term.red('Aborted!\n');
}

async function askCodeScanned() {
    const { scanned } = await prompts({
        type: 'confirm',
        name: 'scanned',
        message: 'Have you scanned the QR code?',
        initial: true
    });

    if (scanned) getControlLink();
    else term.red('Aborted!').black('\n');
}

function getControlLink() {
    axios.post('https://apps.lovense.com/api/lan/command', {}, {
        params: {
            token: config.token,
            uid: config.uniqueID,
            command: 'GetToys',
        }
    }).then(async ({ data: { code, data: toys } }) => {
        if ([407, 406].includes(code)) term.red("You're app is disconnected.\n").cyan(`Launch it then restart the script.\n`);
        else if (!toys) term.yellow("You don't have any toys connected to you're Lovense Connect App.\n").cyan(`Are you sure you've scanned the QR code ?\n`);
        else {
            const toysList = Object.values(toys);

            const { toy } = await prompts({
                type: 'select',
                name: 'toy',
                message: `Which toy needs a link?`,
                choices: toysList.sort((a, b) => a.status === b.status ? 0 : a.status < b.status ? 1 : -1).map(toy => ({
                    title: `(${toy.status ? 'Online' : 'Offline'}) ${toy.name}`,
                    description: toy.nickName,
                    value: toy,
                })).concat([
                    {
                        title: 'Cancel',
                        description: 'Cancel and get no link.',
                        value: false,
                    }
                ])
            });

            if (!toy) {
                term.yellow('Canceled!').black('\n');
            } else {
                axios.post('https://apps.lovense.com/developer/v2/createSession', {}, {
                    params: {
                        token: config.token,
                        customerid: config.uniqueID,
                        toyId: toy.id,
                        toyType: toy.name,
                    }
                }).then(({ data }) => {
                    term(`You're control link: `).yellow(data.data.controlLink).black('\n');
                })
            }
        }
    })
}