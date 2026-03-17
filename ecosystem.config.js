module.exports = {
  apps: [
    {
      name: "rushless-exam",
      script: "server.js",
      cwd: "/app",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        TZ: "Asia/Jakarta",
      },
    },
    {
      name: "redis-server",
      script: "redis-server",
      args: "--bind 127.0.0.1 --save '' --appendonly no",
      exec_mode: "fork",
    },
  ],
};
