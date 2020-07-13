const path = require('path');
const os = require('os');
const opn = require('better-opn');
const express = require('express')
const axios = require('axios');
const fs = require('fs');
const term = require('terminal-kit').terminal;

const lovenseRequests = require('../utils/lovense-requests.js');

const app = express();
const web_port = 6969;
const public_folder = path.join(path.resolve(__dirname), '/public');

const config_file = path.join(path.resolve(__dirname), '../config.json');
let config = {token: undefined, uniqueID: `${os.hostname()}-${os.release()}`};

async function start() {
    config = JSON.parse(fs.readFileSync(config_file, {encoding: 'utf8'}));

    const server = app.listen(web_port, function () {
        opn(`http://localhost:${web_port}`);
    });

    app.use(express.static(public_folder));

    app.get('/qr-code', async (req, res) => {
        const {data} = await lovenseRequests.getQrCode(config.token, config.uniqueID);
        res.json({url: data.message});
    });

    app.get('/toys', async (req, res) => {
        const {data} = await lovenseRequests.getToysList(config.token, config.uniqueID);
        res.json(data);
    });

    app.get('/control-link', async (req, res) => {
        const {data} = await lovenseRequests.getSessionLink(config.token, config.uniqueID, req.query.toy);
        res.json(data);
    });

    app.get('/control-link-check', async (req, res) => {
        axios.get(req.query.link)
            .then(async ({data}) => {
                const sID = data.match(/\/app\/ws2\/play\/([A-z0-9]*)/)[1];
                const state = await lovenseRequests.getSessionState(sID);

                res.json({code: 0, state});
            })
            .catch(() => res.json({code: 500}))
    });

    app.get('/close-interface', (req, res) => {
        res.end();
        term.cyan(`\nClosing express server.`).black('\n\n');
        server.close(() => {
            term.yellow(`Express server closed.`).black('\n\n');
        });
    });
}

module.exports = start;
