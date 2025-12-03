module.exports = {
  apps: [
    {
      name: 'doc-bosowa-backend',
      script: 'dist/main.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        DATABASE_URL: 'postgresql://user:pass@host:5432/dbname?schema=public',
        PYTHON_SERVICE_URL: 'http://127.0.0.1:8000',
        UPLOAD_DIR: 'uploads',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: 'postgresql://user:pass@host:5432/dbname?schema=public',
        PYTHON_SERVICE_URL: 'http://127.0.0.1:8000',
        UPLOAD_DIR: 'uploads',
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
