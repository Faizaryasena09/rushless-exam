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
      },
    },
  ],
};
