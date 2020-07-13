const os = require('os');
const path = require('path');
const opn = require('better-opn');
const prompts = require('prompts');
const axios = require('axios');
const fs = require('fs');
const term = require('terminal-kit').terminal;

const lovenseRequests = require('../utils/lovense-requests.js');

const config_file = path.join(path.resolve(__dirname), '../config.json');
let config = {token: undefined, uniqueID: `${os.hostname()}-${os.release()}`};

async function start() {
    config = JSON.parse(fs.readFileSync(config_file, {encoding: 'utf8'}));

    const {action} = await prompts({
        type: 'select',
        name: 'action',
        message: `What do you want to do?`,
        choices: [
            {
                title: 'Scan QR Code',
                description: `Scran a QR code to register you're lovense connect app.`,
                value: 'qrcode',
            },
            {
                title: 'Get Control Link',
                description: `Display a list of you're toys and get a control link for one of them.`,
                value: 'link',
            },
            {
                title: 'Check Control Link',
                description: `Check if a control link status.`,
                value: 'check-link',
            },
            {
                title: 'Quit',
                description: `Quit the app.`,
                value: 'quit',
            },
        ],
    });

    switch (action) {
        case 'qrcode':
            scanQrCode();
            break;
        case 'link':
            getControlLink();
            break;
        case 'check-link':
            checkControlLink();
            break;
        default:
            term.red('Program stopped, See you next time!\n');
    }
}

async function scanQrCode() {
    const {action} = await prompts({
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
            },
        ],
    });

    if (action) {
        const {data} = await lovenseRequests.getQrCode(config.token, config.uniqueID);

        if (data.code === 0) {
            if (action === 'browser') opn(data.message);
            else term('\nQR Code link: ').yellow(data.message).black('\n\n');

            askCodeScanned();
        }
    } else start();
}

async function askCodeScanned() {
    const {scanned} = await prompts({
        type: 'confirm',
        name: 'scanned',
        message: 'Have you scanned the QR code?',
        initial: true,
    });

    if (scanned) getControlLink();
    else start();
}

async function getControlLink() {
    const {data: {code, data: toys}} = await lovenseRequests.getToysList(config.token, config.uniqueID);

    if ([407, 406].includes(code)) {
        term.red("You're app is disconnected.\n");
        start();
    } else if (!toys) {
        term.yellow("You don't have any toys connected to you're Lovense Connect App.\n").cyan(`Are you sure you've scanned the QR code ?\n`);
        start();
    } else {
        const toysList = Object.values(toys);

        const {toy} = await prompts({
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
                },
            ]),
        });

        if (!toy) {
            term.yellow('Canceled!').black('\n');
            start();
        } else {
            const {data} = await lovenseRequests.getSessionLink(config.token, config.uniqueID, toy);

            if (data.code === 0) term(`\nYou're control link: `).yellow(data.data.controlLink).black('\n\n');
            else term.yellow(`Error getting you're control link`).black('\n\n');

            start();
        }
    }
}

async function checkControlLink() {
    const {url} = await prompts({
        type: 'text',
        name: 'url',
        message: `What's URL do you want to check?`,
        validate: async (value) => {
            const matchLink = value.match(/(https|http):\/\/(apps|api2)\.lovense\.com\/c\/(.*)/gi);

            if (!matchLink) return 'Invalid URI';

            const {data} = await axios.get(value);

            if (data.code && data.code === 404) return 'Invalid URI';

            const sID = data.match(/\/app\/ws2\/play\/([A-z0-9]*)/)[1];

            if (!sID) return `Can't find Session ID`;

            return true;
        },
    });

    if (!url) start();
    else {
        axios.get(url)
            .then(async ({data}) => {
                const sID = data.match(/\/app\/ws2\/play\/([A-z0-9]*)/)[1];
                const state = await lovenseRequests.getSessionState(sID);

                switch (state) {
                    case 'queue':
                        term.cyan(`\nYou're URL is still waiting for someone to take control.`).black('\n\n');
                        break;
                    case 'controlling':
                        term.cyan(`\nSomeone is in control of the toy.`).black('\n\n');
                        break;
                    case 'unauthorized':
                        term.yellow(`\nYou can't use this link anymore.`).black('\n\n');
                        break;
                    default:
                        term.yellow(`\nUnknown status ${state}, you can report this status on our github.`).black('\n\n');
                        break;
                }

                start();
            })
    }
}

module.exports = start;
