const express = require('express');
const session = require('express-session');
const path = require('path');
const axios = require('axios');
const https = require("https");
const app = express();
const bodyParser = require('body-parser');
const json5 = require('json5');
const currentDir = __dirname;
const validator = require('validator');

global.fs = require('fs');
global.colors = require('colors');
global.bcrypt = require('bcrypt');

// Load Config;
const configPath = path.join(currentDir, 'config.jsonc');
const exampleConfigPath = path.join(currentDir, 'config.jsonc.example');
let config;

if (fs.existsSync(configPath)) {
    config = json5.parse(fs.readFileSync(configPath, 'utf8'));
} else {
    const exampleConfigContent = fs.readFileSync(exampleConfigPath, 'utf8');
    fs.writeFileSync(configPath, exampleConfigContent);
    config = json5.parse(exampleConfigContent);
    console.error(colors.red(`[ERROR] config.jsonc not found!\nI have create the 'config.jsonc' from 'config.jsonc.example' automatically for you.\nPlease edit now the 'config.jsonc' file and restart this process! By by, see you later...`));
    process.exit();
};

global.config = config;
global.tools = require('./tools.js');
colors.enable();
app.use(bodyParser.json());

if (process.getuid() == 0) {
    console.error(colors.red(`[ERROR] Starting Job-Balancer-Server as root is not allowed!`));
    process.exit();
};

console.info('');
console.info(colors.green('-----------------------'));
console.info(colors.green('Job-Balancer-Server    '));
console.info(colors.green('Software Version: 0.0.1'));
console.info(colors.green('Node type: Server      '));
console.info(colors.green('-----------------------'));
console.info('');

const database = require('./database.js');
var db = database.connection;
var users = [];
var tmpUsers = [];

async function main() {

    //await tools.generateRandomCertificate();
    const randomSessionKey = await tools.generateRandomSessionKey();
    const NetworkDetails = await tools.getNetworkDetails();

    // Session configuration;
    app.use(session({
        secret: randomSessionKey,
        resave: false,
        saveUninitialized: false
    }));

    // Check sql connection;
    if (! await database.checkSqlConnection()) {
        console.error(colors.red(`[ERROR] Database connection failed. Check your credentials in config.jsonc!`));
        process.exit();
    };

    // Check database connection;
    if (! await database.checkDatabase()) {
        console.warn(colors.yellow(`[WARN] Database not exist! Create new one...`));
        if (! await database.createDatabase()) {
            console.error(colors.red(`[ERROR] Create database failed!`));
            process.exit();
        };
    };

    try {
        db.changeUser({ database: config.database.database }, function (err) {
            if (err) throw err;
        });
    } catch (error) {
    }

    if (! await database.createTables()) {
        console.error(colors.red(`[ERROR] Create database tables failed!`));
        process.exit();
    };

    users = await tools.getUsers();

    if (!users.length) {
        const randomUsername = await tools.generateRandomUsername();
        const randomPassword = await tools.generateRandomPassword();
        tmpUsers = [
            { Id: 1, UserName: randomUsername, PassWord: randomPassword.hashed },
        ];
        console.info(colors.blue(`\n[INFO] No users found! Create temporary webinterface credentials \nUsername: ${randomUsername} \nPassword: ${randomPassword.plain}`));
    };

    app.use('/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css'))); // Bootstrap css
    app.use('/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js'))); // Bootstrap js
    app.use('/js', express.static(path.join(__dirname, 'node_modules/jquery/dist'))); // jQuery js
    app.use('/js', express.static(path.join(__dirname, 'node_modules/@popperjs/core/dist/umd'))); // Popper js
    app.use('/css', express.static(path.join(__dirname, 'node_modules/mdb-ui-kit/css'))); // MDB css
    app.use('/js', express.static(path.join(__dirname, 'node_modules/mdb-ui-kit/js'))); // MDB css
    app.use('/css', express.static(path.join(__dirname, 'views/css'))); // Custom css
    app.use('/js', express.static(path.join(__dirname, 'views/js'))); // Custom js
    app.use('/js', express.static(path.join(__dirname, 'node_modules/datatables.net/js'))); // Custom js
    app.use('/css', express.static(path.join(__dirname, 'node_modules/datatables.net-bs5/css'))); // Custom js
    app.use('/js', express.static(path.join(__dirname, 'node_modules/datatables.net-bs5/js'))); // Custom js
    app.use('/css', express.static(path.join(__dirname, 'node_modules/datatables.net-buttons-bs5/css'))); // Custom js
    app.use('/js', express.static(path.join(__dirname, 'node_modules/datatables.net-buttons/js'))); // Custom js
    app.use('/js', express.static(path.join(__dirname, 'node_modules/datatables.net-buttons-bs5/js'))); // Custom js
    app.use('/css', express.static(path.join(__dirname, 'node_modules/datatables.net-responsive-bs5/css'))); // Custom js
    app.use('/js', express.static(path.join(__dirname, 'node_modules/datatables.net-responsive/js'))); // Custom js
    app.use('/js', express.static(path.join(__dirname, 'node_modules/datatables.net-responsive-bs5/js'))); // Custom js
    app.use('/css', express.static(path.join(__dirname, 'node_modules/datatables.net-select-bs5/css'))); // Custom js
    app.use('/js', express.static(path.join(__dirname, 'node_modules/datatables.net-select/js'))); // Custom js
    app.use('/js', express.static(path.join(__dirname, 'node_modules/datatables.net-select-bs5/js'))); // Custom js

    app.use(express.json());

    /**
     * ✅ [VIEW] - Dashboard;
     */
    app.get("/", (req, res) => {
        res.redirect('/login');
    });

    /**
     * ✅ [VIEW] - Login;
     */
    app.get('/login', (req, res) => {
        res.sendFile(path.join(__dirname, 'views/login.html'))
    });

    app.use(bodyParser.urlencoded({ extended: false }));

    app.post('/login', async (req, res) => {
        const { username, password } = req.body;
        users = await tools.getUsers();

        if (!users.length) {
            users = tmpUsers;
        };

        const user = users.find(u => u.UserName === username);

        if (user && bcrypt.compareSync(password, user.PassWord)) {
            req.session.user = user;
            return res.redirect('/dashboard');
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ [VIEW] - Dashboard;
     */
    app.get("/dashboard", (req, res) => {
        if (req.session.user) {
            res.sendFile(path.join(__dirname, 'views/dashboard.html'))
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ [VIEW] - Users;
     */
    app.get("/users", (req, res) => {
        if (req.session.user) {
            res.sendFile(path.join(__dirname, 'views/users.html'))
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ API - Get Users;
     */
    app.get('/getUsers', function (req, res, next) {
        if (req.session.user) {
            let sql = 'SELECT Id, UserName, PassWord, ApiKey, WebIf FROM USERS';
            db.query(sql, (err, users) => {
                if (err) throw err;
                const data = { users };
                res.json(data)
            });
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ Create User;
     */
    app.post('/createUser', async (req, res) => {

        if (req.session.user) {
            if (validator.isEmpty(req.body.UserName)) throw res.json({ result: false, message: "Required", object: "Username" });
            if (validator.isEmpty(req.body.PassWord)) throw res.json({ result: false, message: "Required", object: "PassWord" });

            const saltRounds = 10;
            const hashedPassword = bcrypt.hashSync(req.body.PassWord, saltRounds);
            const randomApiKey = await tools.generateRandomApiKey();

            let sql = 'INSERT INTO USERS (UserName, PassWord, ApiKey) VALUES (?, ?, ?);';
            db.query(sql, [req.body.UserName, hashedPassword, randomApiKey], (err, jobs) => {
                if (err) {
                    res.json({ result: false, message: 'Unexpected error!' });
                } else {
                    res.json({ result: true, message: 'Insert user success!' });
                };
            });
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ Edit User;
     */
    app.post('/editUser', (req, res) => {
        if (req.session.user) {
            if (validator.isEmpty(req.body.UserName)) throw res.json({ result: false, message: "Required", object: "UserName" });
            if (validator.isEmpty(req.body.PassWord)) throw res.json({ result: false, message: "Required", object: "PassWord" });
            const saltRounds = 10;
            const hashedPassword = bcrypt.hashSync(req.body.PassWord, saltRounds);
            let sql = 'UPDATE USERS SET UserName = ?, PassWord = ? WHERE Id = ?;';
            db.query(sql, [req.body.UserName, hashedPassword, req.body.Id], (err, jobs) => {
                if (err) {
                    res.json({ result: false, message: 'Unexpected error!' });
                } else {
                    res.json({ result: true, message: 'Update user success!' });
                };
            });
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ [VIEW] - Clients;
     */
    app.get("/clients", (req, res) => {
        if (req.session.user) {
            res.sendFile(path.join(__dirname, 'views/clients.html'))
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ [VIEW] - Jobs;
     */
    app.get("/jobs", (req, res) => {
        if (req.session.user) {
            res.sendFile(path.join(__dirname, 'views/jobs.html'))
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ [VIEW] - Scripts;
     */
    app.get("/scripts", (req, res) => {
        if (req.session.user) {
            res.sendFile(path.join(__dirname, 'views/scripts.html'))
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ [API] - CreateScript;
     */
    app.post('/createScript', express.urlencoded({ extended: true }), async (req, res) => {
        if (req.session.user) {
            const interpreter = req.body.interpreter;
            const fileName = req.body.fileName;
            const isValid = await tools.isValidLinuxFilename(fileName);
            if (!isValid) {
                res.status(400).json({ result: false, message: "Invalid file name. The file name may only begin with a-Z and 0-9." });
                return;
            };
            let sql = 'INSERT INTO SCRIPTS (Interpreter, Name) VALUES (?, ?);';
            db.query(sql, [interpreter, fileName], (err, jobs) => {
                if (err) {
                    res.status(500).send('Unexpected error!');
                } else {
                    res.json({ result: true, message: "Script was created successfully!" });
                };
            });
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ [API] - RenameScript;
     */
    app.post('/renameScript', express.urlencoded({ extended: true }), async (req, res) => {
        if (req.session.user) {
            const interpreter = req.body.interpreter;
            const oldFileName = req.body.oldFileName;
            const newFileName = req.body.newFileName;
            const isValid = await tools.isValidLinuxFilename(newFileName);
            if (!isValid) {
                res.status(400).json({ result: false, message: "Invalid file name. The file name may only begin with a-Z and 0-9." });
                return;
            };
            let sql = 'UPDATE SCRIPTS SET Interpreter = ?, Name = ? WHERE Name = ?;';
            db.query(sql, [interpreter, newFileName, oldFileName], (err, jobs) => {
                if (err) {
                    res.status(500).send('Unexpected error!');
                } else {
                    res.json({ result: true, message: "File successfully renamed!" });
                };
            });

        } else {
            res.redirect('/login');
        }
    });

    /**
     * ✅ [API] - EditScript;
     */
    app.get('/editScript', async (req, res) => {
        if (req.session.user) {
            const fileName = req.query.fileName;
            const isValid = await tools.isValidLinuxFilename(fileName);
            if (!isValid) {
                res.status(400).json({ result: false, message: "Invalid file name. The file name may only begin with a-Z and 0-9." });
                return;
            };
            let sql = 'SELECT Content FROM SCRIPTS WHERE Name = ?;';
            db.query(sql, [fileName], (err, data) => {
                if (err) {
                    res.status(500).send('Unexpected error!');
                } else {
                    res.send(data[0].Content);
                };
            });

        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ [API] - DeleteScript;
     */
    app.post('/deleteScript', express.urlencoded({ extended: true }), async (req, res) => {
        if (req.session.user) {
            const fileName = req.body.fileName;

            const isValid = await tools.isValidLinuxFilename(fileName);
            if (!isValid) {
                res.status(400).json({ result: false, message: "Invalid file name. The file name may only begin with a-Z and 0-9." });
                return;
            };
            let sql = 'DELETE FROM SCRIPTS WHERE Name = ?;';
            db.query(sql, [fileName], (err, jobs) => {
                if (err) {
                    res.status(500).send('Unexpected error!');
                } else {
                    res.json({ result: true, message: "File successfully deleted!" });
                };
            });

        } else {
            res.redirect('/login');
        }
    });

    /**
     * ✅ [API] - SaveScript;
     */
    app.post('/saveScript', express.urlencoded({ extended: true }), async (req, res) => {
        if (req.session.user) {
            const fileName = req.body.fileName;
            const fileContent = req.body.fileContent;

            const isValid = await tools.isValidLinuxFilename(fileName);
            if (!isValid) {
                res.status(400).json({ result: false, message: "Invalid file name. The file name may only begin with a-Z and 0-9." });
                return;
            };
            const sql = 'UPDATE SCRIPTS SET Content = ? WHERE Name = ?;';
            db.query(sql, [fileContent, fileName], (dbErr, dbRes) => {
                if (dbErr) {
                    res.status(500).send('Unexpected error!');
                } else {
                    res.json({ result: true, message: "File successfully saved!" });
                };
            });

        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ API - Get Scripts;
     */
    app.get('/getScripts', function (req, res, next) {
        if (req.session.user) {
            let sql = 'SELECT SCRIPTS.Id, SCRIPTS.Interpreter, SCRIPTS.Name FROM SCRIPTS;';
            db.query(sql, (err, scripts) => {
                if (err) throw err;
                const data = { scripts };
                res.json(data)
            });
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ API - Add Job;
     */
    app.post('/addJob', async (req, res) => {
        let { scriptId, command, params = {}, userName, apiKey, watchdog = 0 } = req.body;
        if (!apiKey) { return res.status(403).send(); };
        const findUserQuery = 'SELECT * FROM USERS WHERE UserName = ? AND ApiKey = ?';
        db.query(findUserQuery, [userName, apiKey], async (err, users) => {
            if (err) {
                console.error(`[ERROR] Database query error: ${err}`);
                return res.status(500).json({ message: 'Internal server error.' });
            };
            if (users.length === 0) {
                return res.status(401).json({ message: 'Unauthorized. Invalid Usename or/and API key.' });
            };
            if (scriptId && scriptId > 0) {
                const getScriptQuery = 'SELECT Interpreter, Name from SCRIPTS WHERE Id = ?';
                db.query(getScriptQuery, [scriptId], async (err, script) => {
                    if (err) {
                        console.error(`[ERROR] Database query error: ${err}`);
                        return res.status(500).json({ message: 'Internal server error.' });
                    };
                    if (script.length === 0 || script.length > 1) {
                        return res.status(401).json({ message: 'Script not found!' });
                    };
                    command = script[0].Interpreter + " " + script[0].Name;
                    if (Object.keys(params).length > 0) {
                        let paramString = '';
                        for (const paramKey in params) {
                            paramString += `"${params[paramKey]}" `;
                        };
                        paramString = paramString.trim();
                        command += " " + paramString;
                        const AddJob = 'INSERT INTO JOBS (StateId, Command, ScriptId, WatchDog, CreatedAt) VALUES (1, ?, ?, ?, NOW());';
                        db.query(AddJob, [command, scriptId, watchdog], async (err, result) => {
                            if (err) {
                                console.error(`[ERROR] Error on adding job: ${err}`);
                                return res.status(400).json({ message: 'Error on adding job.' });
                            } else {
                                var JobId = result.insertId;
                                console.info(`[INFO] New Job with Id ${JobId} added!`);
                                res.status(200).json({ result: true, message: 'Add job sucessfully.' });
                                let BestWorker = await tools.getBestWorker();
                                if (BestWorker) {
                                    let ApiKey = BestWorker.ApiKey;
                                    try {
                                        try {
                                            let AxiosResult;
                                            const Protokoll = BestWorker.UseSSL ? 'https://' : 'http://';

                                            if (BestWorker.Fqdn) {
                                                AxiosResult = await axios.post(Protokoll + BestWorker.Fqdn + ':' + BestWorker.Port + '/executeJob', { JobId, ApiKey });
                                            } else {
                                                AxiosResult = await axios.post(Protokoll + BestWorker.IpAddress + ':' + BestWorker.Port + '/executeJob', { JobId, ApiKey });
                                            };

                                        } catch (error) {
                                            console.error(colors.red(`[ERROR] Sending job to worker failed! (1)`));
                                            throw error;
                                        };
                                    } catch (error) {
                                        console.error(colors.red(`[ERROR] Sending job to worker failed! (2)`));
                                    };
                                } else {
                                    // ❌❌❌❌ TODO: Job to other worker, or set job as error or keep waiting ?? !!
                                    console.error(colors.red(`[ERROR] No worker found for this Job. Job goes to waiting!`));
                                };
                            };
                        });
                    };
                });
            } else {
                const AddJob = 'INSERT INTO JOBS (StateId, Command, WatchDog, CreatedAt) VALUES (1, ?, ?, NOW());';
                db.query(AddJob, [command, watchdog], async (err, result) => {
                    if (err) {
                        console.error(`[ERROR] Error on adding job: ${err}`);
                        return res.status(400).json({ message: 'Error on adding job.' });
                    } else {
                        var JobId = result.insertId;
                        console.info(`[INFO] New Job with Id ${JobId} added!`);
                        res.status(200).json({ result: true, message: 'Add job sucessfully.' });
                        let BestWorker = await tools.getBestWorker();
                        if (BestWorker) {
                            let ApiKey = BestWorker.ApiKey;
                            try {
                                try {
                                    let AxiosResult;
                                    const Protokoll = BestWorker.UseSSL ? 'https://' : 'http://';
                                    if (BestWorker.Fqdn) {
                                        AxiosResult = await axios.post(Protokoll + BestWorker.Fqdn + ':' + BestWorker.Port + '/executeJob', { JobId, ApiKey });
                                    } else {
                                        AxiosResult = await axios.post(Protokoll + BestWorker.IpAddress + ':' + BestWorker.Port + '/executeJob', { JobId, ApiKey });
                                    };
                                } catch (error) {
                                    console.error(colors.red(`[ERROR] Sending job to worker failed! (3)`));
                                    throw error;
                                };
                            } catch (error) {
                                console.error(colors.red(`[ERROR] Sending job to worker failed! (4)`));
                            };
                        } else {
                            // ❌❌❌❌ TODO: Job to other worker, or set job as error or keep waiting ?? !!
                            console.error(colors.red(`[ERROR] No worker found for this Job. Job goes to waiting!`));
                        };
                    };
                });
            };
        });
    });

    /**
     * ✅ API - Get Clients;
     */
    app.get('/getClients', function (req, res, next) {
        if (req.session.user) {
            let sql = 'SELECT Id, StateId, HostName, IpAddress, Port, UseSSL, Fqdn FROM CLIENTS';
            db.query(sql, (err, clients) => {
                if (err) throw err;
                const data = { clients };
                res.json(data)
            });
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ API - Get Jobs;
     */
    app.get('/getJobs', function (req, res, next) {
        if (req.session.user) {
            const page = req.query.page || 1;
            const perPage = req.query.perPage || 10;
            const searchTerm = req.query.search.value || ''; // Suchbegriff vom Benutzer
            const offset = (page - 1) * perPage;
            let sql = `
                SELECT JOBS.Id, JOBS.StateId, CLIENTS.HostName, JOBS.Command, JOBS.WatchDog, JOBS.ReturnCode, JOBS.CreatedAt
                FROM JOBS
                LEFT JOIN CLIENTS ON CLIENTS.Id = JOBS.WorkerId
            `;
            if (searchTerm) {
                sql += `
                    WHERE JOBS.Id LIKE '%${searchTerm}%'
                    OR CLIENTS.HostName LIKE '%${searchTerm}%'
                    OR JOBS.Command LIKE '%${searchTerm}%'
                    -- Weitere Spalten für die Suche hinzufügen
                `;
            };
            sql += `
                ORDER BY JOBS.Id DESC LIMIT ${perPage} OFFSET ${offset};
            `;
            let countSql = 'SELECT COUNT(*) AS totalCount FROM JOBS;';
            db.query(sql, (err, jobs) => {
                if (err) throw err;
                db.query(countSql, (countErr, countResult) => {
                    if (countErr) throw countErr;
                    const totalCount = countResult[0].totalCount;
                    const response = {
                        draw: req.query.draw,
                        recordsTotal: totalCount,
                        recordsFiltered: totalCount,
                        data: jobs.slice(0, perPage)
                    };
                    res.json(response);
                });
            });
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ API - Get Job Detals;
     */
    app.post('/getJobDetails', function (req, res, next) {
        if (req.session.user) {
            const jobId = req.body.JobId;
            let sql = 'SELECT StdOut from LOGGING WHERE JobId = ?;';
            db.query(sql, [jobId], (err, jobs) => {
                if (err) throw err;
                const data = { jobs };
                res.json(data)
            });
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ API - Kill Job;
     */
    app.post('/killJob', async function (req, res, next) {
        if (req.session.user) {
            const { JobId } = req.body;
            try {
                let JobWorker = await tools.getWorkerByJobId(JobId);
                let ApiKey = JobWorker.ApiKey;
                let Id = JobWorker.Id;
                let Pid = JobWorker.Pid;
                if (JobWorker.IpAddress) {
                    let AxiosResult;
                    const Protokoll = JobWorker.UseSSL ? 'https://' : 'http://';
                    try {
                        if (JobWorker.Fqdn) {
                            AxiosResult = await axios.post(Protokoll + JobWorker.Fqdn + ':' + JobWorker.Port + '/killJob', { Id, Pid, ApiKey });
                        } else {
                            AxiosResult = await axios.post(Protokoll + JobWorker.IpAddress + ':' + JobWorker.Port + '/killJob', { Id, Pid, ApiKey });
                        };
                        res.status(200).json(AxiosResult.data);
                    } catch (error) {
                        console.error(colors.red(`[ERROR] Sending job to worker failed! (5)`));
                        throw error;
                    };
                } else {
                    throw new Error('JobWorker.IpAddress is not available.');
                }
            } catch (error) {
                throw error;
            }
        } else {
            res.redirect('/login');
        }
    });

    /**
     * ✅ API - Get Jobs by Date;
     */
    app.post('/getJobsByDate', function (req, res, next) {
        if (req.session.user) {
            let sql = `SELECT
            IFNULL(j.Count, 0) AS Count,
            d.Date
        FROM (
            SELECT DATE(DATE_SUB(NOW(), INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY)) AS Date
            FROM (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS a
            CROSS JOIN (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS b
            CROSS JOIN (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS c
            WHERE DATE(DATE_SUB(NOW(), INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY)) >= DATE_SUB(DATE(NOW()), INTERVAL 1 MONTH)
        ) AS d
        LEFT JOIN (
            SELECT DATE(CreatedAt) AS Date, COUNT(*) AS Count
            FROM JOBS
            GROUP BY DATE(CreatedAt)
        ) AS j ON d.Date = j.Date
        WHERE d.Date <= NOW()
        ORDER BY d.Date ASC;`;
            db.query(sql, (err, jobs) => {
                if (err) throw err;
                const formattedJobs = jobs.map(job => ({
                    Count: job.Count,
                    Date: new Date(job.Date).toISOString().slice(0, 10)
                }));
                const data = { jobs: formattedJobs };
                res.json(data);
            });
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ Edit Client;
     */
    app.post('/editClient', (req, res) => {
        if (req.session.user) {
            if (validator.isEmpty(req.body.HostName)) throw res.json({ result: false, message: "Required", object: "HostName" });
            let sql = 'UPDATE CLIENTS SET HostName = ?  WHERE Id = ?;';
            db.query(sql, [req.body.HostName, req.body.Id], (err, jobs) => {
                if (err) {
                    res.json({ result: false, message: 'Unexpected error!' });
                } else {
                    res.json({ result: true, message: 'Update successfully!' });
                };
            });
        } else {
            res.redirect('/login');
        };
    });

    /**
     * ✅ API - Get KPI;
     */
    app.post('/getKpi', function (req, res, next) {
        if (req.session.user) {
            let sql = `SELECT
            c.HostName AS WorkerId,
            CONCAT(ROUND(SUM(j.CreatedAt >= NOW() - INTERVAL 24 HOUR) / COUNT(*) * 100, 2), '%') AS JobsSummary,
            CONCAT(ROUND(SUM(j.CreatedAt >= NOW() - INTERVAL 24 HOUR AND j.ReturnCode = 0) / COUNT(*) * 100, 2), '%') AS JobsSuccess,
            CONCAT(ROUND(SUM(j.CreatedAt >= NOW() - INTERVAL 24 HOUR AND j.ReturnCode > 0) / COUNT(*) * 100, 2), '%') AS JobsError,
            CONCAT(ROUND(SUM(j.CreatedAt >= NOW() - INTERVAL 48 HOUR AND j.CreatedAt < NOW() - INTERVAL 24 HOUR) / COUNT(*) * 100, 2), '%') AS PrevJobsSummary,
            CONCAT(ROUND(SUM(j.CreatedAt >= NOW() - INTERVAL 48 HOUR AND j.CreatedAt < NOW() - INTERVAL 24 HOUR AND j.ReturnCode = 0) / COUNT(*) * 100, 2), '%') AS PrevJobsSuccess,
            CONCAT(ROUND(SUM(j.CreatedAt >= NOW() - INTERVAL 48 HOUR AND j.CreatedAt < NOW() - INTERVAL 24 HOUR AND j.ReturnCode > 0) / COUNT(*) * 100, 2), '%') AS PrevJobsError
            FROM CLIENTS c
            LEFT JOIN JOBS j ON c.Id = j.WorkerId
            WHERE j.CreatedAt >= NOW() - INTERVAL 48 HOUR
            GROUP BY c.Id, c.HostName;`;
            db.query(sql, (err, kpi) => {
                if (err) throw err;
                const data = { kpi };
                res.json(data)
            });
        } else {
            res.redirect('/login');
        };
    });

    // 🔁 Interval to check if all clients available and response;
    if (config.app.check_workers_interval > 0) {
        setInterval(tools.checkAllClientsBySocket, config.app.check_workers_interval * 1000);
        /** 🆘
         * setInterval(tools.checkAllClientsByPing, config.app.check_workers_interval * 1000);
         * Sporadic: read ECONNRESET
         * Sporadic: socket hang up
         */
    };

    // ✅ Start Server;
    if (config.app.use_ssl && config.ssl.key && config.ssl.cert) {
        https.createServer({
            key: fs.readFileSync(config.ssl.key),
            cert: fs.readFileSync(config.ssl.cert)
        }, app).listen(config.app.port, () => {
            console.info(colors.green(`[INFO] Server running *SECURE* on https://${NetworkDetails.address}:${config.app.port}`));
        });
    } else {
        app.listen(config.app.port, () => {
            console.info(colors.yellow(`\n[INFO] Server running *INSECURE* on http://${NetworkDetails.address}:${config.app.port}`));
        });
    };
};

main();