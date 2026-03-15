module.exports = {
  apps: [
    {
      name: 'rushless-exam',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: './',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
