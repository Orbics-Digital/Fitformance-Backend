module.exports = {
    apps: [
        {
            name: "Fitformance Backend - 9001",
            script: "server.js",
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            max_restarts: 10,
            restart_delay: 3000,
            min_uptime: "10s",
            watch: false,
            max_memory_restart: "500M",
            env: {
                NODE_ENV: "production",
            },
        },
    ],
}