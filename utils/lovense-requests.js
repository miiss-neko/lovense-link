const axios = require('axios');
const os = require('os');

class LovenseRequests {

    async getQrCode(token, uid) {
        return await axios.post('https://api.lovense.com/api/lan/getQrCode', {}, {
            params: {
                token: token,
                uid: uid,
                uname: os.hostname(),
                utoken: uid,
            }
        });
    }

    async getToysList(token, uid) {
        return await axios.post('https://apps.lovense.com/api/lan/command', {}, {
            params: {
                token: token,
                uid: uid,
                command: 'GetToys',
            },
        });
    }

    async getSessionLink(token, uid, toy) {
        return await axios.post('https://apps.lovense.com/developer/v2/createSession', {}, {
            params: {
                token: token,
                customerid: uid,
                toyId: toy.id,
                toyType: toy.name,
            },
        });
    }

    async getSessionState(sessionID) {
        return new Promise((resolve, reject) => {
            axios.post(`https://apps.lovense.com/developer/v2/loading/${sessionID}`)
                .then(({data}) => {
                    return resolve(data.data.status);
                })
                .catch(() => reject());
        })
    }

}

module.exports = new LovenseRequests();
