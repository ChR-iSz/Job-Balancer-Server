# Packages

- [Job-Balancer-Server (this)](https://github.com/ChR-iSz/Job-Balancer-Server)
- [Job-Balancer-Client](https://github.com/ChR-iSz/Job-Balancer-Client)

# Preface

The software consists of *two* parts: this "Job Balancer Server," which receives, distributes, and provides a web interface for jobs, and the "Job Balancer Client," which runs on the workers, executes, and logs jobs. Both apps connect to a shared SQL database that can be hosted separately or on the "Job Balancer Server." This project is currently in development and is not yet finalized in main branch. As such, consider "Job Balancer Server" and "Job Balancer Client" as BETA versions, not recommended for production use. A security review is also pending; thus, we recommend using it only in a secure network for now.

# Job Balancer Server

The "Job Balancer Server" is a powerful and flexible Node.js application serving as a central hub for distributing and managing workloads across a distributed cluster of workers. The application facilitates seamless distribution of resource-intensive tasks, such as transcoding processes with ffmpeg or similar applications, across multiple machines, maximizing overall processing speed, and ensuring efficient resource utilization.

## Problem Statement

Modern application scenarios frequently demand computationally intensive or time-critical processes. Executing such tasks on a single server can lead to bottlenecks and degrade overall performance. Moreover, there's a risk that a machine lacks sufficient resources to efficiently execute certain tasks. The outcome is prolonged processing times, increased latency, and a subpar user experience.

## Approach

The "Job Balancer Server" offers an elegant solution to tackle these challenges. It employs the round-robin algorithm to evenly distribute incoming jobs among available workers, ensuring equitable load distribution and optimal resource utilization.

The application supports an unlimited number of clients (workers), which can be grouped together into a cluster. This allows nearly linear scalability, permitting easy expansion of computing power by adding more workers as needed.

## Functionality

You submit an appropriate POST request using tools like curl, wget, or similar, from any machine to the Job Balancer Server application. The request includes the command to be executed on the worker or an ID (optionally with parameters) for a pre-configured script, conveniently created via the web interface in various languages.

The "Job Balancer Server" acknowledges the job request and promptly dispatches it to an available client (worker). The POST request can optionally include a watchdog time in seconds. After this duration, the job is forcefully terminated if it stalls or gets stuck in an unforeseen state (defunct).

If no free worker is available when transmitting the POST request, the job is marked as 'Occupied' (rejected) or set to 'Waiting' (to be processed later) based on the sent POST parameters (need_realtime: true, false) (default: false).

The web interface allows configuring various settings, such as the maximum number of jobs per worker, the job distribution algorithm, and more. Additionally, job statuses can be viewed, jobs can be restarted, terminated, or deleted during runtime, and a comprehensive log (STDOUT, STDERR) of jobs is accessible for analysis.

## Key Features

- **Load Balancing:** The "Job Balancer Server" evenly distributes jobs among available workers to ensure optimal resource utilization. The round-robin algorithm (configurable) ensures fair treatment of each worker.

- **Efficient Resource Utilization:** Distributing jobs across multiple workers significantly reduces overall processing time by executing tasks in parallel. This optimizes the use of available computing power, enhancing performance.

- **Flexibility and Scalability:** The application seamlessly accommodates additional workers, enhancing cluster performance. There are no fixed limits on the number of supported workers.

- **Intuitive Web Interface:** The Job Balancer Server offers an intuitive web interface for users to monitor, edit, and manage running jobs. Additionally, the interface enables user creation and API key generation for secure job submission.

- **Worker Reliability Check:** The server regularly checks if all registered workers are online and updates their status in the database. This identifies failed or unresponsive workers, allowing appropriate measures.

- **User Management:** Jobs can only be submitted to the "Job Balancer Server" with a valid user or API key. In the future, users can be assigned specific restrictions.

## Installation of "Job Balancer Server"

1. Ensure Node.js and npm are installed on your system, and an SQL instance is available.
2. Clone this repository to your server.
3. Navigate to the main application directory and run `npm install` to install dependencies.
4. Configure the application in the `config.jsonc` file (automatically created on first start).
5. Start the server with the command `node server.js`. (Running the app as 'root' is prohibited and results in an error message.)
6. If you haven't created a user in the web interface or are starting the app for the first time, automatically generated credentials will be displayed for logging into the web interface.

## Web Interface

Depending on the configuration, the web interface can be accessed via the URL `http://localhost:PORT` or `https://localhost:PORT` (see config.jsonc). Here, you can:
- View all jobs and monitor their statuses.
- Prematurely terminate running jobs.
- Create users and generate their API keys.
- View available workers and their workloads.
- Create, edit, or delete scripts.

# Usage
Comit a job via curl or wget, ect:

### Normal Job (without auto-kill-watchdog)
```
curl -X POST -H "Content-Type: application/json" -d '{
    "command": "echo \"Hello World\"",
    "userName": "{your-username}",
    "apiKey": "{your-apikey}"
}' https://{your-domain}:{your-port}/addJob
```

### Normal Job (with auto-kill-watchdog)
```
curl -X POST -H "Content-Type: application/json" -d '{
    "command": "echo \"Hello World\"; sleep 20",
    "watchdog": 10,
    "userName": "{your-username}",
    "apiKey": "{your-apikey}"
}' https://{your-domain}:{your-port}/addJob
```

### Script Job (see webinterface) (without auto-kill-watchdog)
Params are optional and not required if your script don't need params.
```
curl -X POST -H "Content-Type: application/json" -d '{
    "scriptId": "1",
    "params": {
        "param1": "Value",
        "param2": "Value"
    },
    "userName": "{your-username}",
    "apiKey": "{your-apikey}"
}' https://{your-domain}:{your-port}/addJob
```

### Script Job (see webinterface) (with auto-kill-watchdog after 10 Seconds) (Make sure your script running longer as 10 seconds for testing).
Params are optional and not required if your script don't need params.

```
curl -X POST -H "Content-Type: application/json" -d '{
    "scriptId": "1",
    "params": {
        "param1": "Value",
        "param2": "Value"
    },
    "watchdog": 10,
    "userName": "{your-username}",
    "apiKey": "{your-apikey}"
}' https://{your-domain}:{your-port}/addJob
```

## Outlook / Roadmap

- Introduction of job classes, allowing jobs to be limited to specific workers assigned to corresponding job classes. Job classes can be freely created, for example, to execute geo-based tasks.
- Limitation of the maximum number of jobs per worker in the web interface.
- Job restarts via the web interface.
- Time-based job execution (scheduling).
- User rights management for restricting jobs or job classes.
- Worker > Server availability checks.

## General

We welcome contributions to improve this project. If you have an idea or found a bug, please open an issue or pull request.

## License

This project is licensed under the [MIT License](LICENSE).

## Copyright notice

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions.

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

The software is provided "As is", without warranty of any kind, express or implied, including but not limited To the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall The authors or copyright holders be liable for any claim, damages or other liability, whether in an action of Contract, tort or otherwise, arising from, out of or in connection with the software or the use or other Dealings in the software.

## Thanks to

- [mdbootstrap](https://mdbootstrap.com/general/license/#license-free)
- [validator.js](https://github.com/validatorjs/validator.js)

## Developer Environment

- Debian Buster (11.7)
- Mysql Server version: 10.5.19-MariaDB-0+deb11u2 Debian 11
- Node v20.5.0