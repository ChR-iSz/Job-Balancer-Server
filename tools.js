const dns = require('dns');
const net = require('net');
const database = require('./database.js');
const crypto = require('crypto');
const os = require('os');
const forge = require('node-forge');
const tls = require('tls');
const axios = require('axios');
const https = require("https");
const ifaces = os.networkInterfaces();
const bcrypt = global.bcrypt;
const config = global.config;
const fs = global.fs;
const colors = global.colors;

async function generateRandomCertificate() {
    try {

        return await new Promise((resolve, reject) => {

            const privateKeyPath = config.ssl.key;
            const certificatePath = config.ssl.cert;

            try {

                const keys = forge.pki.rsa.generateKeyPair(2048);
                const cert = forge.pki.createCertificate();

                cert.publicKey = keys.publicKey;
                cert.serialNumber = '01';
                cert.validity.notBefore = new Date();
                cert.validity.notAfter = new Date();
                cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

                const attrs = [
                    { name: 'commonName', value: 'example.com' },
                    { name: 'countryName', value: 'US' },
                    { name: 'stateOrProvinceName', value: 'California' },
                    { name: 'localityName', value: 'San Francisco' },
                    { name: 'organizationName', value: 'Example Organization' },
                    { name: 'organizationalUnitName', value: 'IT' }
                ];
                cert.setSubject(attrs);
                cert.setIssuer(attrs);
                cert.sign(keys.privateKey);

                fs.writeFileSync(privateKeyPath, forge.pki.privateKeyToPem(keys.privateKey));
                fs.writeFileSync(certificatePath, forge.pki.certificateToPem(cert));

                return resolve(true);

            } catch (error) {

                console.error(colors.red(`[ERROR] generateRandomCertificate (A) - UNEXPECTED ERROR! ${error}`));
                return reject(false);

            };
        });
    } catch (error) {

        console.error(colors.red(`[ERROR] generateRandomCertificate (B) - UNEXPECTED ERROR! ${error}`));
        return false;

    };
};

/**
 * 
 * @returns Random SessionKey;
 */
async function generateRandomSessionKey() {

    try {

        return await new Promise((resolve, reject) => {
            const randomUsername = Math.random().toString(36).substring(10);
            const randomBytes = crypto.randomBytes(10);
            return resolve(randomBytes.toString('hex'));
        });

    } catch (error) {

        console.error(colors.red('[ERROR] generateRandomSessionKey - UNEXPECTED ERROR!'));
        return false;

    };

};

/**
 * 
 * @returns Random Username;
 */
async function generateRandomUsername() {

    try {

        return await new Promise((resolve, reject) => {

            const randomBytes = crypto.randomBytes(10);
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*()_-+=<>?';
            let randomUsername = '';
            const usernameLength = 15;
            for (let i = 0; i < usernameLength; i++) {
                const randomIndex = Math.floor(Math.random() * characters.length);
                randomUsername += characters[randomIndex];
            };

            return resolve(randomUsername);

        });

    } catch (error) {

        console.error(colors.red('[ERROR] generateRandomUsername - UNEXPECTED ERROR!'));
        return false;

    };

};

/**
 * 
 * @returns Random Password;
 */
async function generateRandomPassword() {

    try {

        return await new Promise((resolve, reject) => {

            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=<>?';
            let randomPassword = '';
            const passwordLength = 15;
            for (let i = 0; i < passwordLength; i++) {
                const randomIndex = Math.floor(Math.random() * characters.length);
                randomPassword += characters[randomIndex];
            };
            const saltRounds = 10;
            const hashedPassword = bcrypt.hashSync(randomPassword, saltRounds);
            let pw = {
                "plain": randomPassword,
                "hashed": hashedPassword
            };

            return resolve(pw);

        });

    } catch (error) {

        console.error(colors.red('[ERROR] generateRandomPassword - UNEXPECTED ERROR!'));
        return false;

    };

};

/**
 * 
 * @returns Random ApiKey;
 */
async function generateRandomApiKey() {

    try {

        return await new Promise((resolve, reject) => {

            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=<>?';
            let randomApiKey = '';
            const passwordLength = 40;
            for (let i = 0; i < passwordLength; i++) {
                const randomIndex = Math.floor(Math.random() * characters.length);
                randomApiKey += characters[randomIndex];
            };

            return resolve(randomApiKey);

        });

    } catch (error) {

        console.error(colors.red('[ERROR] generateRandomApiKey - UNEXPECTED ERROR!'));
        return false;

    };

};

async function getUsers() {

    var connection = database.connection;

    try {

        return await new Promise((resolve, reject) => {

            const GetBestWorker = 'SELECT Id, UserName, PassWord, ApiKey, WebIf FROM USERS;';
            connection.query(GetBestWorker, (err, res) => {
                if (err) {
                    console.error(colors.red('[ERROR] SELECT USERS - UNEXPECTED ERROR!'));
                    return reject(false);
                } else {
                    return resolve(res);
                };
            });

        });

    } catch (error) {

        console.error(colors.red('[ERROR] getUsers - UNEXPECTED ERROR!'));
        return false;

    };

};

async function checkAllClientsByPing() {

    return new Promise(async (resolve, reject) => {

        var connection = database.connection;
        const getAllClientsQuery = 'SELECT Id, StateId, Serial, HostName, IpAddress, Port, UseSSL, Fqdn, ApiKey FROM CLIENTS;';

        connection.query(getAllClientsQuery, async (error, results) => {

            if (error) {
                console.error(colors.red('Fehler beim Abrufen der Clients:', error));
                return;
            };

            if (results.length > 0) {

                for (const client of results) {

                    const Protokoll = client.UseSSL ? 'https://' : 'http://';

                    let response;

                    try {
                        const ApiKey = client.ApiKey;

                        const axiosConfig = {
                            timeout: 2000, // Milliseconds;
                        };

                        if (client.Fqdn) {
                            response = await axios.post(Protokoll + client.Fqdn + ':' + client.Port + '/ping', { ApiKey }, axiosConfig);
                        } else {
                            response = await axios.post(Protokoll + client.IpAddress + ':' + client.Port + '/ping', { ApiKey }, axiosConfig);
                        };

                        if (response.status === 200 && response.data.result === true && response.data.message === 'pong') {

                            console.log(colors.green(`[INFO] Client ${client.HostName} is online and responding as expected.`));
                            if (!client.StateId == 1) { // 1 = Online;
                                await updateClientState(connection, client.Id, 1);
                                console.info(`[INFO] Update client in database to online (available)!`);
                            };

                        } else {

                            console.log(colors.red(`[INFO] Client ${client.HostName} is online but not responding as expected.`));
                            if (!client.StateId == 0 || !client.StateId == 2) { // 0 = Offline, 2 = Disabled;
                                await updateClientState(connection, client.Id, 0);
                                console.info(`[INFO] Update client in database to offline (not available)!`);
                            };

                        }
                    } catch (error) {

                        console.error(colors.red(`[INFO] Client ${client.Fqdn} is offline or encountered an error: ${error}`));

                        if (!client.StateId == 0 || !client.StateId == 2) { // 0 = Offline, 2 = Disabled;
                            await updateClientState(connection, client.Id, 0);
                            console.info(`[INFO] Update client in database to offline (not available)!`);
                        };

                    };
                };

                return resolve(true);

            } else {

                console.error(colors.red('No available workers found. Please start the node script on client workers...'));
            };

        });

    });

};

async function updateClientState(connection, clientId, newStateId) {

    const UpdateClient = 'UPDATE CLIENTS SET StateId = ? WHERE Id = ?';

    return new Promise((resolve, reject) => {

        connection.query(UpdateClient, [newStateId, clientId], (err, result) => {
            if (err) {
                console.log(colors.red(`[ERROR] Can't update client in database!`));
                reject(err);
            } else {
                console.info(`[INFO] Updated client in database to state ${newStateId}!`);
                resolve(result);
            }
        });

    });

};

async function checkAllClientsBySocket() {

    var connection = database.connection;
    const getAllClientsQuery = 'SELECT Id, StateId, Serial, HostName, IpAddress, Port, UseSSL, Fqdn, ApiKey FROM CLIENTS;';

    connection.query(getAllClientsQuery, (error, results) => {

        if (error) {
            console.error(colors.red('Fehler beim Abrufen der Clients:', error));
            return;
        };

        if (results.length > 0) {
            results.forEach(client => {

                const socket = new net.Socket();
                socket.connect(client.Port, client.IpAddress, () => {
                    console.log(colors.green(`[INFO] Client ${client.HostName} is online.`));
                    socket.destroy();
                    if (!client.StateId == 1) { // 1 = Online;
                        const UpdateClient = 'UPDATE CLIENTS SET StateId = 1 WHERE Id = ?';
                        connection.query(UpdateClient, [client.Id], (err, result) => {
                            if (err) {
                                console.log(colors.red(`[ERROR] Can't update client in database!`));
                            } else {
                                console.info(`[INFO] Update client in database to online (available)!`);
                            };
                        });
                    };
                });

                socket.on('error', (error) => {
                    console.log(colors.red(`[WARN] Client ${client.HostName} is offline.`));
                    socket.destroy();
                    if (!client.StateId == 0 || !client.StateId == 2) { // 0 = Offline, 2 = Disabled;
                        const UpdateClient = 'UPDATE CLIENTS SET StateId = 0 WHERE Id = ?';
                        connection.query(UpdateClient, [client.Id], (err, result) => {
                            if (err) {
                                console.log(colors.red(`[ERROR] Can't update client in database!`));
                            } else {
                                console.info(`[INFO] Update client in database to offline (not available)!`);
                            };
                        });
                    };
                });

            });

        } else {

            console.error(colors.red('No available workers found. Please start the node script on client workers...'));
        }

    });

};

async function getBestWorker(workerClassId) {

    console.log("[FUNC] getBestWorker -> workerClassId: "+workerClassId);

    var connection = database.connection;

    try {

        return await new Promise((resolve, reject) => {

            // const GetBestWorker = 'SELECT Id, Serial, ApiKey, IpAddress, Port, UseSSL, Fqdn, (SELECT COUNT(*) FROM JOBS WHERE WorkerId = CLIENTS.Id AND ( JOBS.StateId = 1 OR JOBS.StateId = 2) ) as RunningJobs from CLIENTS WHERE StateId = 1 ORDER BY RunningJobs ASC, HostName ASC LIMIT 1;';
            const GetBestWorker = `SELECT 
            C.Id, C.Serial, C.ApiKey, C.IpAddress, C.Port, C.UseSSL, C.Fqdn,
            (
                SELECT COUNT(*) 
                FROM JOBS 
                WHERE WorkerId = C.Id 
                AND (JOBS.StateId = 1 OR JOBS.StateId = 2)
            ) AS RunningJobs,
            JC.MaxJobs
            FROM CLIENTS AS C
            JOIN WORKER_CLASSES AS JC ON C.WorkerClassId = JC.Id
            WHERE C.StateId = 1 AND C.WorkerClassId = ?
            HAVING RunningJobs < JC.MaxJobs
            ORDER BY RunningJobs ASC, C.HostName ASC 
            LIMIT 1;`;

            connection.query(GetBestWorker, [workerClassId], (err, res) => {
                if (err) {
                    return reject(err);
                } else {
                    if (res.length > 0 && res[0].Id > 0) {
                        const socket = new net.Socket();
                        socket.connect(res[0].Port, res[0].IpAddress, () => {
                            console.info(`[INFO] Best Worker found and it is online: ${res[0].IpAddress}:${res[0].Port}`);
                            socket.destroy();
                            return resolve(res[0]);
                        });
                        socket.on('error', (error) => {
                            console.log(colors.red(`[ERROR] Best Worker found but it is offline: ${res[0].IpAddress}:${res[0].Port}`));
                            socket.destroy();
                            return reject(error);
                        });
                    } else {
                        // 🆘 No bestworker found !! What we can do ??? Still keep the waiting status for a job ?
                        return reject(res);
                    };
                };
            });

        });

    } catch (error) {
        // 🆘 No bestworker found !! What we can do ??? Still keep the waiting status for a job ?
        console.error(colors.red(`[CATCH-ERROR] getBestWorker failed - ${error}`));
        return false;

    };

};

async function getWorkerByJobId(jobid) {

    var connection = database.connection;

    try {

        return await new Promise((resolve, reject) => {

            const GetWorker = 'SELECT JOBS.Id, JOBS.Pid, CLIENTS.Serial, CLIENTS.ApiKey, CLIENTS.IpAddress, CLIENTS.Port, CLIENTS.UseSSL, CLIENTS.Fqdn FROM JOBS LEFT JOIN CLIENTS ON CLIENTS.Id = JOBS.WorkerId WHERE JOBS.Id = ? LIMIT 1;';
            connection.query(GetWorker, [jobid], (err, res) => {
                if (err) {
                    console.error(colors.red('[ERROR] SELECT WORKER BY ID failed!'));
                    return reject(false);
                } else {
                    if (res.length > 0 && res[0].Id > 0) {
                        return resolve(res[0]);
                    } else {
                        return reject(false);
                    };
                };
            });

        });

    } catch (error) {

        console.error(colors.red('[ERROR] getWorkerByJobId - UNEXPECTED ERROR!'));
        return false;

    };

};

async function getNetworkDetails() {

    console.log("[INFO] GetNetworkDetails...");

    try {

        return new Promise((resolve, reject) => {

            for (const interfaceKey in ifaces) {
                const interface = ifaces[interfaceKey];
                for (const iface of interface) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        iface.hostname = os.hostname();
                        iface.clientid = crypto.createHash('md5').update(iface.mac + "-" + iface.address + "-" + os.hostname()).digest("hex");
                        return resolve(iface);
                    };
                };
            };

        });

    } catch (error) {

        console.error(colors.red('[ERROR] getNetworkDetails - UNEXPECTED ERROR!'));
        return false;

    };

};

async function isValidLinuxFilename(filename) {

    const validCharsRegex = /^[a-zA-Z0-9_\-\.]+$/;
    const maxFilenameLength = 255;

    if (!filename.match(/^[a-z0-9]+/i)) {
        return false
    }

    if (!filename.match(/[a-z0-9]+$/i)) {
        return false
    }

    if (filename.length > maxFilenameLength) {
        return false;
    }

    if (!validCharsRegex.test(filename)) {
        return false;
    }

    if (filename.startsWith('.') || filename.startsWith('-')) {
        return false;
    }

    if (filename.endsWith('.')) {
        return false;
    }

    return true;

}

module.exports = {
    generateRandomCertificate,
    generateRandomSessionKey,
    generateRandomUsername,
    generateRandomPassword,
    generateRandomApiKey,
    getUsers,
    getNetworkDetails,
    checkAllClientsByPing,
    checkAllClientsBySocket,
    getBestWorker,
    getWorkerByJobId,
    isValidLinuxFilename
};